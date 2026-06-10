// QA 交互测试:验证项目菜单、重命名、对话菜单等"手做功能"有没有暗 bug。
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
  const shot = (n) => win.screenshot({ path: path.join(dir, n + ".png") }).then(() => console.log("shot", n));
  const tap = async (loc, n) => {
    try { await loc.click({ timeout: 3000 }); await win.waitForTimeout(500); if (n) await shot(n); return true; }
    catch (e) { console.log("SKIP", n, String(e.message).split("\n")[0]); return false; }
  };

  // 悬停项目头让按钮出现,再点「...」菜单
  await win.locator(".project-header").first().hover().catch(() => {});
  await win.waitForTimeout(300);
  await tap(win.locator(".project-header .thread-menu-trigger").nth(1), "i1-project-menu");

  // 点菜单里的「重命名」-> 应出现行内输入框
  await tap(win.getByText("重命名", { exact: true }).first(), "i2-project-rename");

  // 在输入框打字看看
  try {
    await win.locator(".project-header input.thread-rename-input").fill("测试改名");
    await win.waitForTimeout(300);
    await shot("i3-rename-typing");
    await win.keyboard.press("Escape");
  } catch (e) { console.log("SKIP rename-typing", String(e.message).split("\n")[0]); }

  await app.close();
  console.log("interact done");
})().catch((e) => { console.error(e); process.exit(1); });
