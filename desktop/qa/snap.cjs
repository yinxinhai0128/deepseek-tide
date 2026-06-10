// QA 截图脚本:用 Playwright 自动启动 Electron App(加载已构建的 dist,无需 vite),
// 截图当前界面。用法:node qa/snap.cjs [输出路径]
const { _electron } = require("playwright");
const path = require("path");

(async () => {
  const env = { ...process.env, WHALETIDE_USE_DIST: "1" };
  delete env.ELECTRON_RUN_AS_NODE; // 否则 Electron 会退化成 node 模式起不了窗口

  const app = await _electron.launch({
    args: ["."],
    cwd: path.resolve(__dirname, ".."),
    env
  });

  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1800); // 等界面/状态稳定

  const out = process.argv[2] || path.join(__dirname, "snap.png");
  await win.screenshot({ path: out });
  console.log("screenshot saved:", out);

  await app.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
