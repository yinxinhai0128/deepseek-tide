const { _electron } = require("playwright");
const path = require("path");
(async () => {
  const env = { ...process.env, WHALETIDE_USE_DIST: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], cwd: path.resolve(__dirname, ".."), env });
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1500);
  await win.getByText("性能", { exact: true }).click().catch(() => {});
  await win.waitForTimeout(800);
  await win.screenshot({ path: path.join(__dirname, "shots", "perf.png") });
  console.log("done");
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
