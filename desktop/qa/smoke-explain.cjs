// 真实端到端:在临时工作区让 AI 改一个文件,验证「讲解模式」会输出「📝 小结」。
const { _electron } = require("playwright");
const path = require("path");
const fs = require("fs");
const os = require("os");

(async () => {
  const ws = path.join(os.tmpdir(), "dstide-explain-test");
  fs.mkdirSync(ws, { recursive: true });
  fs.writeFileSync(path.join(ws, "a.txt"), "old content", "utf8");

  const env = { ...process.env, WHALETIDE_USE_DIST: "1", WHALETIDE_WORKSPACE: ws };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], cwd: path.resolve(__dirname, ".."), env });
  const win = await app.firstWindow();
  win.on("dialog", (d) => d.accept().catch(() => {}));
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(2000);
  await win.getByRole("button", { name: "取消" }).click({ timeout: 2000 }).catch(() => {});

  const connected = await win.getByText("DeepSeek 已连接").count().then((c) => c > 0).catch(() => false);
  console.log("已连接:", connected);
  if (!connected) { console.log("FAIL 未连接,无法跑真实任务"); await app.close(); return; }

  // 放手干模式(自动执行,不询问)
  await win.locator("select").first().selectOption("yolo");
  await win.waitForTimeout(300);

  await win.locator("textarea").fill("把当前目录里的 a.txt 文件内容改成 hello world");
  await win.locator(".send-button").click();
  console.log("任务已发出,等待完成…");

  // 等运行结束(停止按钮消失)
  await win.locator(".send-button.stop").waitFor({ state: "detached", timeout: 180000 }).catch(() => {});
  await win.waitForTimeout(1500);

  const bodyText = await win.locator("body").innerText();
  const hasSummary = bodyText.includes("📝 小结") || bodyText.includes("小结");
  const fileText = fs.readFileSync(path.join(ws, "a.txt"), "utf8");
  const fileChanged = /hello world/i.test(fileText);

  console.log((hasSummary ? "PASS" : "FAIL") + " 输出包含「📝 小结」");
  console.log((fileChanged ? "PASS" : "FAIL") + " a.txt 已被改为 hello world(实际: " + JSON.stringify(fileText.slice(0, 40)) + ")");
  await win.screenshot({ path: path.join(__dirname, "shots", "explain-mode.png") });

  await app.close();
  try { fs.rmSync(ws, { recursive: true, force: true }); } catch {}
})().catch((e) => { console.error(e); process.exit(1); });
