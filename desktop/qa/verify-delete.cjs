// 验证「移除项目」修复:删当前工作区项目 -> 重载后应仍然不在(不被迁移补回)。
const { _electron } = require("playwright");
const path = require("path");

(async () => {
  const env = { ...process.env, WHALETIDE_USE_DIST: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], cwd: path.resolve(__dirname, ".."), env });
  const win = await app.firstWindow();
  win.on("dialog", (d) => d.accept().catch(() => {}));
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(2200);
  await win.locator(".project-header").first().waitFor({ timeout: 6000 }).catch(() => {});

  const names = async () => win.locator(".project-header .project-name").allInnerTexts();
  const before = await names();
  console.log("BEFORE projects:", JSON.stringify(before));

  const headers = win.locator(".project-header");
  if ((await headers.count()) === 0) { console.log("NO PROJECTS, abort"); await app.close(); return; }

  const first = headers.first();
  await first.hover();
  await win.waitForTimeout(300);
  await first.locator(".thread-menu-trigger").nth(1).click();
  await win.waitForTimeout(400);
  await win.getByText("移除项目", { exact: true }).click();
  await win.waitForTimeout(800);

  const afterDelete = await names();
  console.log("AFTER delete:", JSON.stringify(afterDelete));

  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(2200);
  const afterReload = await names();
  console.log("AFTER reload:", JSON.stringify(afterReload));

  const deletedName = before[0];
  const stillGone = !afterReload.includes(deletedName);
  console.log(stillGone ? `PASS: 「${deletedName}」已删除且重载后未复活` : `FAIL: 「${deletedName}」又回来了`);

  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
