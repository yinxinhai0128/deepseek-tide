const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const path = require("path");
const { parseAuthStatus } = require("./auth-status.cjs");
const { buildCacheProfile, compareProfiles } = require("./cache-profile.cjs");
const {
  canonicalDirectory,
  ensureDirectoryInside,
  isPathInside
} = require("./workspace-security.cjs");

// 安装版用独立、干净的 userData 命名空间(对齐 productName),
// 避免与开发版(deepseek-tide-desktop)共用目录、把调试时的项目/花费泄漏给真实用户。
// 必须在任何 app.getPath("userData") 调用之前设置。
if (app.isPackaged) {
  app.setName("DeepSeek-Tide");
}

let mainWindow;
let activeAgent = null;
let workspace = process.cwd();
let approvedWorkspaces = new Set();

function codeWhaleBinary() {
  const name = process.platform === "win32" ? "codewhale.exe" : "codewhale";
  const packaged = path.join(process.resourcesPath, "codewhale", name);
  const development = path.resolve(__dirname, "..", "..", "vendor", "codewhale", name);
  return app.isPackaged ? packaged : development;
}

function approvedWorkspacesPath() {
  return path.join(app.getPath("userData"), "approved-workspaces.json");
}

function workspaceKey(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function loadApprovedWorkspaces() {
  try {
    const values = JSON.parse(fs.readFileSync(approvedWorkspacesPath(), "utf8"));
    return new Set(
      values
        .filter((value) => typeof value === "string" && fs.existsSync(value))
        .map(canonicalDirectory)
        .map(workspaceKey)
    );
  } catch {
    return new Set();
  }
}

function approveWorkspace(value) {
  const canonical = canonicalDirectory(value);
  approvedWorkspaces.add(workspaceKey(canonical));
  fs.mkdirSync(path.dirname(approvedWorkspacesPath()), { recursive: true });
  fs.writeFileSync(approvedWorkspacesPath(), JSON.stringify([...approvedWorkspaces]), {
    encoding: "utf8",
    mode: 0o600
  });
  return canonical;
}

function isWorkspaceApproved(value) {
  return approvedWorkspaces.has(workspaceKey(value));
}

function terminateProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore"
    });
  } else {
    child.kill("SIGTERM");
  }
}

function stripTerminalControl(value) {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

function attachmentMime(filePath, fallback = "") {
  if (fallback) return fallback;
  const types = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json"
  };
  return types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function safeAttachmentName(value) {
  const extension = path.extname(value);
  const stem = path.basename(value, extension).replace(/[^\w.-]+/g, "_").slice(0, 80) || "attachment";
  return `${stem}${extension.toLowerCase()}`;
}

function attachmentResult(filePath, baseWorkspace) {
  const stat = fs.statSync(filePath);
  const mime = attachmentMime(filePath);
  const isImage = mime.startsWith("image/");
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: path.basename(filePath),
    path: filePath,
    relativePath: path.relative(baseWorkspace, filePath).replaceAll("\\", "/"),
    size: stat.size,
    mime,
    isImage,
    preview:
      isImage && stat.size <= 10 * 1024 * 1024
        ? `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`
        : null
  };
}

function importAttachment(source, baseWorkspace) {
  const maxSize = 20 * 1024 * 1024;
  const canonicalWorkspace = canonicalDirectory(baseWorkspace);
  let sourcePath = source.path ? fs.realpathSync.native(path.resolve(source.path)) : null;
  let data = null;
  if (!sourcePath && source.data) {
    data = Buffer.from(source.data, "base64");
    if (data.length > maxSize) throw new Error(`${source.name || "附件"} 超过 20 MB`);
  }
  if (sourcePath) {
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile()) throw new Error(`${source.name || sourcePath} 不是文件`);
    if (stat.size > maxSize) throw new Error(`${source.name || sourcePath} 超过 20 MB`);
  }

  const alreadyInside = sourcePath && isPathInside(canonicalWorkspace, sourcePath);
  let destination = sourcePath;
  if (!alreadyInside) {
    const attachmentDir = ensureDirectoryInside(
      canonicalWorkspace,
      path.join(canonicalWorkspace, ".deepseek-tide", "attachments")
    );
    const name = safeAttachmentName(source.name || sourcePath || "attachment");
    destination = path.join(attachmentDir, `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${name}`);
    if (sourcePath) fs.copyFileSync(sourcePath, destination);
    else fs.writeFileSync(destination, data);
  }
  const canonicalDestination = fs.realpathSync.native(destination);
  if (!isPathInside(canonicalWorkspace, canonicalDestination)) {
    throw new Error("附件路径超出工作区");
  }
  return attachmentResult(canonicalDestination, canonicalWorkspace);
}

function emitAgent(event) {
  if (!mainWindow?.isDestroyed()) {
    mainWindow.webContents.send("agent:event", event);
  }
}

function localProxy(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(180);
    socket.once("connect", () => finish(`http://127.0.0.1:${port}`));
    socket.once("timeout", () => finish(null));
    socket.once("error", () => finish(null));
  });
}

async function detectProxy() {
  if (process.env.DEEPSEEK_TIDE_PROXY) return process.env.DEEPSEEK_TIDE_PROXY;
  if (process.env.WHALETIDE_PROXY) return process.env.WHALETIDE_PROXY;
  if (process.env.HTTPS_PROXY) return process.env.HTTPS_PROXY;
  for (const port of [7897, 7890, 10809, 1080]) {
    const proxy = await localProxy(port);
    if (proxy) return proxy;
  }
  return null;
}

async function runtimeEnv() {
  const env = { ...process.env, NO_COLOR: "1", TERM: "dumb" };
  const proxy = await detectProxy();
  if (proxy) {
    env.HTTP_PROXY = proxy;
    env.HTTPS_PROXY = proxy;
  }
  return env;
}

function runCodeWhale(args, options = {}) {
  return new Promise(async (resolve) => {
    const child = spawn(codeWhaleBinary(), args, {
      cwd: options.cwd || workspace,
      env: await runtimeEnv(),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    if (options.stdin) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
    child.on("error", (error) =>
      resolve({ code: -1, stdout, stderr: `${stderr}\n${error.message}` })
    );
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

async function runtimeStatus() {
  const binary = codeWhaleBinary();
  if (!fs.existsSync(binary)) {
    return {
      installed: false,
      authenticated: false,
      authSource: "missing",
      version: "",
      proxy: null,
      workspace
    };
  }
  const [version, auth, proxy] = await Promise.all([
    runCodeWhale(["--version"]),
    runCodeWhale(["auth", "status", "--provider", "deepseek"]),
    detectProxy()
  ]);
  const authOutput = stripTerminalControl(`${auth.stdout}\n${auth.stderr}`);
  const parsedAuth = parseAuthStatus(authOutput);
  return {
    installed: version.code === 0,
    authenticated: auth.code === 0 && parsedAuth.authenticated,
    authSource: parsedAuth.source,
    version: stripTerminalControl(version.stdout).trim(),
    proxy,
    workspace,
    error: auth.code === 0 ? null : authOutput.trim()
  };
}

function profileStatePath() {
  return path.join(app.getPath("userData"), "cache-profile.json");
}

function readPreviousProfile() {
  try {
    return JSON.parse(fs.readFileSync(profileStatePath(), "utf8"));
  } catch {
    return null;
  }
}

function writeProfile(profile) {
  fs.mkdirSync(path.dirname(profileStatePath()), { recursive: true });
  const temporary = `${profileStatePath()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(profile), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, profileStatePath());
}

function usageStatePath() {
  return path.join(app.getPath("userData"), "desktop-usage.json");
}

function readDesktopUsage() {
  try {
    return JSON.parse(fs.readFileSync(usageStatePath(), "utf8"));
  } catch {
    return { input_tokens: 0, output_tokens: 0, turns: 0 };
  }
}

// DeepSeek 官方价格（元 / 百万 token，2026-04-26 调价后）：未命中输入 / 命中输入 / 输出。
const MODEL_PRICING_CNY = {
  "deepseek-v4-flash": { input: 1, inputCached: 0.02, output: 2 },
  "deepseek-v4-pro": { input: 3, inputCached: 0.025, output: 6 }
};

// 引擎不暴露每轮真实缓存命中数。缓存命中主要发生在单轮 agent 内部循环里——同一个
// 大前缀被反复发送，第二次起即命中。编码 agent 的实际命中率通常很高，这里按 90%
// 估算，得到的是近似真实花费（非账单），而不是最贵的未命中上限。
const CACHE_HIT_RATE = 0.9;

function estimateCostCny(inputTokens, outputTokens, model) {
  const price = MODEL_PRICING_CNY[model] || MODEL_PRICING_CNY["deepseek-v4-flash"];
  const effectiveInput = CACHE_HIT_RATE * price.inputCached + (1 - CACHE_HIT_RATE) * price.input;
  return (Number(inputTokens) * effectiveInput + Number(outputTokens) * price.output) / 1_000_000;
}

function recordDesktopUsage(meta) {
  if (!meta || typeof meta !== "object") return;
  const usage = readDesktopUsage();
  usage.input_tokens += Number(meta.input_tokens || 0);
  usage.output_tokens += Number(meta.output_tokens || 0);
  usage.turns += 1;
  fs.mkdirSync(path.dirname(usageStatePath()), { recursive: true });
  fs.writeFileSync(usageStatePath(), JSON.stringify(usage), {
    encoding: "utf8",
    mode: 0o600
  });
}

async function runtimePerformance(model = "deepseek-v4-flash") {
  const status = await runtimeStatus();
  const desktopUsage = readDesktopUsage();
  const usage = {
    totals: {
      input_tokens: desktopUsage.input_tokens,
      output_tokens: desktopUsage.output_tokens,
      cached_tokens: null,
      reasoning_tokens: null,
      cost_usd: null,
      cost_cny: estimateCostCny(desktopUsage.input_tokens, desktopUsage.output_tokens, model),
      turns: desktopUsage.turns
    }
  };
  const profile = buildCacheProfile({
    workspace,
    runtimeVersion: status.version,
    model
  });
  const previous = readPreviousProfile();
  const changes = compareProfiles(previous, profile);
  writeProfile(profile);
  return {
    usage,
    usageError: null,
    cache: {
      hitRate: null,
      label: previous && previous.fingerprint !== profile.fingerprint ? "已变化" : "稳定"
    },
    profile: {
      fingerprint: profile.fingerprint.slice(0, 12),
      changed: Boolean(previous && previous.fingerprint !== profile.fingerprint),
      changes
    }
  };
}

function parseUpdateResult(result) {
  const output = stripTerminalControl(`${result.stdout}\n${result.stderr}`).trim();
  const current = output.match(/Current version:\s*v?([^\s]+)/i)?.[1] || "";
  const latest = output.match(/Latest stable release:\s*v?([^\s]+)/i)?.[1] || "";
  return {
    ok: result.code === 0,
    current,
    latest,
    available: Boolean(current && latest && current !== latest),
    output,
    error: result.code === 0 ? null : output || `更新命令失败（退出码 ${result.code}）`
  };
}

function parseJsonLines(stream, onValue) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += stripTerminalControl(chunk.toString());
    while (buffer.includes("\n")) {
      const newline = buffer.indexOf("\n");
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("{")) continue;
      try {
        onValue(JSON.parse(line));
      } catch {
        onValue({ type: "log", content: line });
      }
    }
  });
  stream.on("end", () => {
    const line = buffer.trim();
    if (!line.startsWith("{")) return;
    try {
      onValue(JSON.parse(line));
    } catch {
      onValue({ type: "log", content: line });
    }
  });
}

function registerIpc() {
  ipcMain.handle("workspace:choose", async () => {
    if (activeAgent) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择代码工作区",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    workspace = approveWorkspace(result.filePaths[0]);
    return workspace;
  });
  ipcMain.handle("workspace:set", async (_event, target) => {
    try {
      const next = canonicalDirectory(target);
      if (next === workspace) return { ok: true, workspace };
      if (activeAgent) return { ok: false, error: "请等待当前任务结束后再切换工作区" };
      if (!isWorkspaceApproved(next)) {
        return { ok: false, error: "该工作区尚未通过系统目录选择器授权" };
      }
      workspace = next;
      return { ok: true, workspace };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("workspace:get", () => workspace);
  ipcMain.handle("attachments:choose", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "添加文件或图片",
      properties: ["openFile", "multiSelections"]
    });
    if (result.canceled) return { ok: true, attachments: [] };
    try {
      const attachments = result.filePaths.slice(0, 8).map((filePath) =>
        importAttachment({ path: filePath, name: path.basename(filePath) }, workspace)
      );
      return { ok: true, attachments };
    } catch (error) {
      return { ok: false, attachments: [], error: error.message };
    }
  });
  ipcMain.handle("attachments:import", async (_event, sources) => {
    try {
      if (!Array.isArray(sources)) throw new Error("附件数据无效");
      const attachments = sources.slice(0, 8).map((source) => importAttachment(source, workspace));
      return { ok: true, attachments };
    } catch (error) {
      return { ok: false, attachments: [], error: error.message };
    }
  });
  ipcMain.handle("runtime:status", runtimeStatus);
  ipcMain.handle("runtime:performance", (_event, model) => runtimePerformance(model));
  ipcMain.handle("runtime:update-check", async () => {
    const result = await runCodeWhale(["update", "--check"]);
    return parseUpdateResult(result);
  });
  ipcMain.handle("runtime:update-apply", async () => {
    if (activeAgent) return { ok: false, error: "请等待当前任务结束后再更新运行时。" };
    const result = await runCodeWhale(["update"]);
    return parseUpdateResult(result);
  });
  ipcMain.handle("auth:save", async (_event, apiKey) => {
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      return { ok: false, error: "API key 不能为空" };
    }
    const result = await runCodeWhale(
      ["auth", "set", "--provider", "deepseek", "--api-key-stdin"],
      { stdin: `${apiKey.trim()}\n` }
    );
    if (result.code !== 0) {
      return {
        ok: false,
        error:
          stripTerminalControl(`${result.stderr}\n${result.stdout}`).trim() ||
          `CodeWhale 认证命令失败（退出码 ${result.code}）`
      };
    }
    const status = await runtimeStatus();
    if (!status.authenticated) {
      return {
        ok: false,
        status,
        error: "API key 已提交，但 CodeWhale 未能读取保存后的凭据。请检查用户目录写入权限。"
      };
    }
    const check = await validateDeepSeekKey(apiKey.trim());
    return { ok: true, status, check };
  });
  ipcMain.handle("auth:clear", async () => {
    const result = await runCodeWhale(["auth", "clear", "--provider", "deepseek"]);
    return { ok: result.code === 0 };
  });
  ipcMain.handle("usage:reset", async () => {
    try {
      fs.rmSync(usageStatePath(), { force: true });
    } catch {
      /* 文件不存在或删除失败都视为已清零 */
    }
    return { ok: true };
  });
  ipcMain.handle("workspace:files", async () => {
    const base = workspace;
    const ignored = new Set([".git", "node_modules", "dist", "target", ".venv"]);
    const walk = (directory, depth = 0) => {
      if (depth > 4) return [];
      try {
        return fs
          .readdirSync(directory, { withFileTypes: true })
          .filter((entry) => !ignored.has(entry.name))
          .slice(0, 200)
          .map((entry) => {
            const absolute = path.join(directory, entry.name);
            return {
              name: entry.name,
              path: path.relative(base, absolute),
              type: entry.isDirectory() ? "directory" : "file",
              children: entry.isDirectory() ? walk(absolute, depth + 1) : undefined
            };
          });
      } catch {
        return [];
      }
    };
    return walk(base);
  });
  ipcMain.handle("git:status", async () => {
    const result = await new Promise((resolve) => {
      const child = spawn("git", ["status", "--short", "--branch"], {
        cwd: workspace,
        windowsHide: true
      });
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk.toString()));
      child.on("close", () => resolve(output));
      child.on("error", () => resolve(""));
    });
    return result;
  });
  ipcMain.handle("git:diff", async () => {
    const result = await new Promise((resolve) => {
      const child = spawn("git", ["diff", "--no-ext-diff", "--unified=3"], {
        cwd: workspace,
        windowsHide: true
      });
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk.toString()));
      child.on("close", () => resolve(output));
      child.on("error", () => resolve(""));
    });
    return result;
  });
  ipcMain.handle("shell:open-external", async (_event, url) => {
    try {
      const parsed = new URL(String(url));
      const host = parsed.hostname.toLowerCase();
      const allowed =
        parsed.protocol === "https:" &&
        (host === "deepseek.com" || host.endsWith(".deepseek.com"));
      if (!allowed) return { ok: false, error: "仅允许打开 DeepSeek 官方页面" };
      await shell.openExternal(parsed.toString());
      return { ok: true };
    } catch {
      return { ok: false, error: "无效链接" };
    }
  });
  ipcMain.handle("workspace:reveal", async (_event, target) => {
    const dir = typeof target === "string" && target ? target : workspace;
    const error = await shell.openPath(dir);
    return { ok: !error, error: error || null };
  });
  ipcMain.handle("snapshot:status", async () => {
    return { canUndo: await hasSnapshot(workspace) };
  });
  ipcMain.handle("snapshot:undo", async () => {
    return undoLastSnapshot(workspace);
  });
  ipcMain.handle("agent:start", async (_event, payload) => {
    if (activeAgent) return { ok: false, error: "已有任务正在运行" };
    const target = workspace;
    const modes = new Set(["plan", "agent", "yolo"]);
    const models = new Set(["deepseek-v4-flash", "deepseek-v4-pro", "auto"]);
    if (!payload || typeof payload.prompt !== "string" || payload.prompt.length > 1_000_000) {
      return { ok: false, error: "任务内容无效或过长" };
    }
    if (!modes.has(payload.mode) || !models.has(payload.model)) {
      return { ok: false, error: "模型或运行模式无效" };
    }
    const args = ["-C", target, "--model", payload.model || "deepseek-v4-flash"];
    if (payload.mode === "yolo") args.push("--yolo");
    args.push("exec");
    if (payload.mode === "yolo" || payload.mode === "agent") args.push("--auto");
    args.push("--output-format", "stream-json");
    if (payload.sessionId) args.push("--resume", payload.sessionId);
    args.push(payload.prompt);

    // 开跑前快照当前工作区，供"一键撤销"还原。尽力而为，不阻断任务。
    await snapshotWorkspace(target);

    const child = spawn(codeWhaleBinary(), args, {
      cwd: target,
      env: await runtimeEnv(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    activeAgent = child;
    emitAgent({ type: "process_start" });
    parseJsonLines(child.stdout, (event) => {
      if (event.type === "metadata") recordDesktopUsage(event.meta);
      emitAgent(event);
    });
    child.stderr.on("data", (chunk) => {
      const content = stripTerminalControl(chunk.toString()).trim();
      if (content) emitAgent({ type: "stderr", content });
    });
    child.on("error", (error) => {
      emitAgent({ type: "error", content: error.message });
    });
    child.on("close", (code) => {
      emitAgent({ type: "process_end", code });
      activeAgent = null;
    });
    return { ok: true };
  });
  ipcMain.handle("agent:stop", () => {
    if (!activeAgent) return { ok: true };
    terminateProcessTree(activeAgent);
    return { ok: true };
  });
}

// ---- 影子 git 快照（撤销 AI 改动）----
// 在应用数据目录维护一个独立的 git 仓库（GIT_DIR），工作树指向用户工作区。
// 绝不创建/修改用户自己的 .git，对非 git 项目同样可用。

const SNAPSHOT_EXCLUDES = [
  ".git/",
  "node_modules/",
  "dist/",
  "build/",
  "release/",
  "vendor/",
  "__pycache__/",
  ".npm-cache/",
  ".electron-builder-cache/",
  ".localappdata/",
  ".cache/",
  "*.log"
];

// 用 DeepSeek 余额接口真实验证 key:既验有效性,又查余额(不耗 token)。
async function validateDeepSeekKey(apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch("https://api.deepseek.com/user/balance", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal
    });
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "DeepSeek 拒绝了这个 key(无效或已撤销)" };
    }
    if (!response.ok) {
      return { valid: null, error: `暂时无法验证(DeepSeek 返回 ${response.status})` };
    }
    const data = await response.json();
    const info = Array.isArray(data?.balance_infos) ? data.balance_infos[0] : null;
    return {
      valid: true,
      available: Boolean(data?.is_available),
      balance: info?.total_balance ?? null,
      currency: info?.currency ?? null
    };
  } catch {
    return { valid: null, error: "无法连接 DeepSeek(请检查网络)" };
  } finally {
    clearTimeout(timer);
  }
}

function shadowGitDir(ws) {
  const id = crypto.createHash("sha1").update(path.resolve(ws)).digest("hex").slice(0, 16);
  return path.join(app.getPath("userData"), "snapshots", id);
}

function runGitShadow(ws, args) {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd: ws,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_DIR: shadowGitDir(ws),
        GIT_WORK_TREE: ws,
        GIT_CONFIG_NOSYSTEM: "1"
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (error) => resolve({ code: -1, stdout, stderr: String(error) }));
  });
}

async function ensureShadowGit(ws) {
  const dir = shadowGitDir(ws);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    await runGitShadow(ws, ["init"]);
    const infoDir = path.join(dir, "info");
    fs.mkdirSync(infoDir, { recursive: true });
    fs.writeFileSync(path.join(infoDir, "exclude"), SNAPSHOT_EXCLUDES.join("\n") + "\n", {
      encoding: "utf8"
    });
  }
}

// 在每轮 AI 任务开始前调用：把当前工作区状态提交为一个快照。尽力而为，失败不阻断任务。
async function snapshotWorkspace(ws) {
  try {
    await ensureShadowGit(ws);
    await runGitShadow(ws, ["add", "-A"]);
    const result = await runGitShadow(ws, [
      "-c",
      "user.email=snapshot@deepseek-tide.local",
      "-c",
      "user.name=DeepSeek-Tide",
      "commit",
      "--allow-empty",
      "--no-gpg-sign",
      "-m",
      `snapshot ${new Date().toISOString()}`
    ]);
    return result.code === 0;
  } catch {
    return false;
  }
}

async function hasSnapshot(ws) {
  if (!fs.existsSync(shadowGitDir(ws))) return false;
  const result = await runGitShadow(ws, ["rev-parse", "--verify", "HEAD"]);
  return result.code === 0;
}

// 撤销 AI 上一次的改动：把工作区还原到最近一次快照（上一轮开始前的状态）。
async function undoLastSnapshot(ws) {
  if (!(await hasSnapshot(ws))) return { ok: false, error: "没有可撤销的快照" };
  const reset = await runGitShadow(ws, ["reset", "--hard", "HEAD"]);
  if (reset.code !== 0) {
    return { ok: false, error: reset.stderr.trim() || "还原失败" };
  }
  await runGitShadow(ws, ["clean", "-fd"]);
  return { ok: true };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: "#0d0e10",
    title: "DeepSeek-Tide",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (!app.isPackaged && !process.env.WHALETIDE_USE_DIST) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
  if (process.env.WHALETIDE_SMOKE_SCREENSHOT) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const ready = await mainWindow.webContents.executeJavaScript(
            "Boolean(document.querySelector('.app-shell'))"
          );
          if (ready) break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(process.env.WHALETIDE_SMOKE_SCREENSHOT, image.toPNG());
        app.quit();
      }, 500);
    });
  }
  if (process.env.WHALETIDE_SMOKE_LAYOUT_OUTPUT) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        const attachmentPaths = JSON.parse(
          process.env.WHALETIDE_SMOKE_ATTACHMENT_PATHS || "[]"
        );
        const attachmentSources = attachmentPaths.map((filePath) => ({
          path: filePath,
          name: path.basename(filePath)
        }));
        const result = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            const conversation = document.querySelector(".conversation");
            const probe = document.createElement("div");
            probe.style.height = "1800px";
            probe.style.pointerEvents = "none";
            conversation?.appendChild(probe);
            const imported = await window.whale.importAttachments(${JSON.stringify(
              attachmentSources
            )});
            const result = {
              conversation: conversation ? {
                clientHeight: conversation.clientHeight,
                scrollHeight: conversation.scrollHeight,
                maxScroll: conversation.scrollHeight - conversation.clientHeight,
                overflowY: getComputedStyle(conversation).overflowY
              } : null,
              activityCards: document.querySelectorAll(".activity-card").length,
              legacyToolCards: document.querySelectorAll(".tool-card").length,
              attachButton: Boolean(document.querySelector(".attach-button")),
              imported
            };
            probe.remove();
            return result;
          })()
        `);
        fs.writeFileSync(
          process.env.WHALETIDE_SMOKE_LAYOUT_OUTPUT,
          JSON.stringify(result, null, 2)
        );
        app.quit();
      }, 1800);
    });
  }
  if (process.env.WHALETIDE_SMOKE_AGENT_OUTPUT) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        const payload = {
          workspace,
          prompt: process.env.WHALETIDE_SMOKE_PROMPT || "Reply exactly DESKTOP_BRIDGE_OK",
          model: "deepseek-v4-flash",
          mode: "plan"
        };
        const result = await mainWindow.webContents.executeJavaScript(`
          new Promise(async (resolve) => {
            const events = [];
            let content = "";
            const timeout = setTimeout(() => resolve({ ok: false, content, events, error: "timeout" }), 90000);
            const dispose = window.whale.onAgentEvent((event) => {
              events.push(event.type);
              if (event.type === "content") content += event.content || "";
              if (event.type === "done" || event.type === "process_end" || event.type === "error") {
                clearTimeout(timeout);
                dispose();
                resolve({ ok: event.type !== "error", content, events });
              }
            });
            const started = await window.whale.startTurn(${JSON.stringify(payload)});
            if (!started.ok) {
              clearTimeout(timeout);
              dispose();
              resolve({ ok: false, content, events, error: started.error });
            }
          })
        `);
        fs.writeFileSync(
          process.env.WHALETIDE_SMOKE_AGENT_OUTPUT,
          JSON.stringify(result, null, 2)
        );
        app.quit();
      }, 800);
    });
  }
}

app.whenReady().then(() => {
  const requestedWorkspace = process.env.WHALETIDE_WORKSPACE;
  approvedWorkspaces = loadApprovedWorkspaces();
  if (requestedWorkspace && fs.existsSync(requestedWorkspace)) {
    workspace = approveWorkspace(requestedWorkspace);
  } else if (app.isPackaged) {
    const defaultWorkspace = path.join(app.getPath("documents"), "DeepSeek-Tide Workspace");
    fs.mkdirSync(defaultWorkspace, { recursive: true });
    workspace = approveWorkspace(defaultWorkspace);
  } else {
    workspace = approveWorkspace(path.resolve(__dirname, "..", ".."));
  }
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (activeAgent) terminateProcessTree(activeAgent);
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (activeAgent) terminateProcessTree(activeAgent);
});
