// QA 扫描:自动驱动 App 走遍关键界面并逐一截图,供逐张分析找 bug。
const { _electron } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const env = { ...process.env, WHALETIDE_USE_DIST: "1" };
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await _electron.launch({ args: ["."], cwd: path.resolve(__dirname, ".."), env });
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1800);

  const dir = path.join(__dirname, "shots");
  fs.mkdirSync(dir, { recursive: true });
  const shot = async (name) => {
    await win.screenshot({ path: path.join(dir, name + ".png") });
    console.log("shot:", name);
  };
  const tap = async (locator, name, settle = 600) => {
    try {
      await locator.click({ timeout: 3000 });
      await win.waitForTimeout(settle);
      if (name) await shot(name);
      return true;
    } catch (e) {
      console.log("SKIP", name || "", "->", String(e.message).split("\n")[0]);
      return false;
    }
  };

  await shot("01-main");

  // 开通向导(设置)
  if (await tap(win.locator(".sidebar-footer button").first(), "02-onboarding")) {
    await tap(win.getByText("取消", { exact: true }), null);
  }

  // 项目「...」菜单(项目头第 2 个触发器 = ...)
  await tap(win.locator(".project-header .thread-menu-trigger").nth(1), "03-project-menu");
  await win.keyboard.press("Escape").catch(() => {});
  await win.waitForTimeout(300);

  // 右侧三个面板
  await tap(win.getByText("性能", { exact: true }), "04-perf");
  await tap(win.getByText("文件", { exact: true }), "05-files");
  await tap(win.getByText("变更", { exact: true }), "06-changes");

  // 布局:收起左栏 / 再收右栏
  await tap(win.locator(".brand .push-right"), "07-left-collapsed");
  await tap(win.locator(".right-tabs .push-right"), "08-both-collapsed");

  await app.close();
  console.log("sweep done");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
