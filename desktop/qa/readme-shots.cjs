// 给 README 截 4 张图:主界面 / 开通向导 / 花费(性能) / 撤销(变更)
const { _electron } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const env = { ...process.env, WHALETIDE_USE_DIST: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], cwd: path.resolve(__dirname, ".."), env });
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(2200);

  const dir = path.join(__dirname, "shots");
  fs.mkdirSync(dir, { recursive: true });
  const shot = (n) => win.screenshot({ path: path.join(dir, n + ".png") }).then(() => console.log("shot", n));
  const closeDialog = async () => {
    await win.getByRole("button", { name: "取消" }).click({ timeout: 2500 }).catch(() => {});
    await win.waitForTimeout(400);
  };

  // 启动时若向导自动弹出,先关掉以拿干净主界面
  await closeDialog();

  // 1) 主界面
  await win.waitForTimeout(400);
  await shot("main");

  // 2) 开通向导:点左下角设置打开
  await win.locator(".sidebar-footer button").first().click({ timeout: 3000 }).catch((e) => console.log("SKIP open-settings", e.message.split("\n")[0]));
  await win.waitForTimeout(700);
  if (await win.locator(".onboard-steps").count().then(c => c > 0).catch(() => false)) {
    await shot("onboard");
  }
  await closeDialog();

  // 3) 花费:点「性能」标签
  await win.getByText("性能", { exact: true }).click({ timeout: 3000 }).catch((e) => console.log("SKIP perf", e.message.split("\n")[0]));
  await win.waitForTimeout(800);
  await shot("cost");

  // 4) 撤销:临时造一个影子快照让「撤销」按钮出现,截完立即删掉(避免给真实用户留下危险空快照)
  const ws = "C:\\Users\\Yinxh\\Documents\\whale code";
  const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath("userData"));
  const crypto = require("crypto");
  const { spawnSync } = require("child_process");
  const id = crypto.createHash("sha1").update(path.resolve(ws)).digest("hex").slice(0, 16);
  const seededDir = path.join(userData, "snapshots", id);
  fs.mkdirSync(seededDir, { recursive: true });
  const envg = { ...process.env, GIT_DIR: seededDir, GIT_WORK_TREE: ws, GIT_CONFIG_NOSYSTEM: "1" };
  spawnSync("git", ["init"], { cwd: ws, env: envg, windowsHide: true });
  // 仅做一个空提交,不 add 任何文件,绝不改动工作区
  spawnSync("git", ["-c", "user.email=s@d.local", "-c", "user.name=DS", "commit", "--allow-empty", "--no-gpg-sign", "-m", "demo"], { cwd: ws, env: envg, windowsHide: true });
  console.log("seeded snapshot at", seededDir);

  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(2200);
  await closeDialog();
  await win.getByText("变更", { exact: true }).click({ timeout: 3000 }).catch((e) => console.log("SKIP changes", e.message.split("\n")[0]));
  await win.waitForTimeout(900);
  await shot("undo");

  await app.close();
  // 删除临时快照,恢复安全默认(无快照)
  try { fs.rmSync(seededDir, { recursive: true, force: true }); console.log("cleaned seeded snapshot"); }
  catch (err) { console.log("clean failed", String(err)); }
  console.log("readme-shots done");
})().catch((e) => { console.error(e); process.exit(1); });
