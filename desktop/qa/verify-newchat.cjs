// 验证顶部「新对话」按钮:可见、点击后新增一条对话。
const { _electron } = require("playwright");
const path = require("path");

(async () => {
  const env = { ...process.env, WHALETIDE_USE_DIST: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], cwd: path.resolve(__dirname, ".."), env });
  const win = await app.firstWindow();
  win.on("dialog", (d) => d.accept().catch(() => {}));
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1500);

  await win.evaluate(() => {
    const now = Date.now();
    localStorage.setItem("deepseek-tide.desktop.projects.v1", JSON.stringify([
      { path: "C:\\Demo\\alpha", name: "alpha", addedAt: now }
    ]));
    localStorage.setItem("deepseek-tide.desktop.threads.v1", JSON.stringify([
      { id: "t1", title: "老对话", workspace: "C:\\Demo\\alpha", updatedAt: now,
        messages: [{ id: "t1m", role: "user", content: "hi", createdAt: now }] }
    ]));
    localStorage.setItem("deepseek-tide.desktop.removed-projects.v1", "[]");
  });
  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1800);
  await win.getByRole("button", { name: "取消" }).click({ timeout: 2000 }).catch(() => {});

  const btn = win.locator(".new-chat-primary");
  const visible = await btn.isVisible().catch(() => false);
  console.log((visible ? "PASS" : "FAIL") + " 顶部「新对话」按钮可见");
  await win.screenshot({ path: path.join(__dirname, "shots", "newchat-button.png") });

  const before = await win.locator(".thread-list").innerText();
  const hadNew = before.includes("新任务");
  await btn.click();
  await win.waitForTimeout(600);
  const after = await win.locator(".thread-list").innerText();
  const created = !hadNew && after.includes("新任务");
  console.log((created ? "PASS" : "FAIL") + " 点击后新增「新任务」对话");
  await win.screenshot({ path: path.join(__dirname, "shots", "newchat-after.png") });

  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
