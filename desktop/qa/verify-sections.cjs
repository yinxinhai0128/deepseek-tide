// 验证侧栏两大区:项目 / 对话;新对话进对话区;折叠;拖拽聊天归入项目。
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
    const mk = (id, title, ws) => ({
      id, title, workspace: ws, updatedAt: now,
      messages: [{ id: id + "m", role: "user", content: "x", createdAt: now }]
    });
    localStorage.setItem("deepseek-tide.desktop.projects.v1", JSON.stringify([
      { path: "C:\\Demo\\alpha", name: "alpha", addedAt: now }
    ]));
    localStorage.setItem("deepseek-tide.desktop.threads.v1", JSON.stringify([
      mk("f1", "项目内对话", "C:\\Demo\\alpha"),
      mk("l1", "松散对话", "C:\\Loose\\place")
    ]));
  });
  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1800);
  await win.getByRole("button", { name: "取消" }).click({ timeout: 2000 }).catch(() => {});

  const results = [];
  const ok = (n, c) => results.push((c ? "PASS " : "FAIL ") + n);
  const titles = await win.locator(".sidebar-section-title span").allInnerTexts();
  ok("有「项目」区标题", titles.includes("项目"));
  ok("有「对话」区标题", titles.includes("对话"));

  let list = await win.locator(".thread-list").innerText();
  ok("项目内对话在(项目区)", list.includes("项目内对话"));
  ok("松散对话在(对话区)", list.includes("松散对话"));

  const alphaCount = () => win.locator(".project-count").first().innerText();
  ok("alpha 初始 1 条", (await alphaCount()).trim() === "1");

  // 拖拽:把「松散对话」拖到 alpha 项目头
  const looseRow = win.locator(".thread-row", { hasText: "松散对话" });
  const alphaHeader = win.locator(".project-header", { hasText: "alpha" });
  await looseRow.dragTo(alphaHeader);
  await win.waitForTimeout(700);
  ok("拖拽后 alpha 变 2 条", (await alphaCount()).trim() === "2");

  // 新对话进对话区
  await win.locator(".new-chat-primary").click();
  await win.waitForTimeout(500);
  list = await win.locator(".thread-list").innerText();
  ok("新对话产生「新任务」", list.includes("新任务"));

  // 折叠对话区
  const chatsTitle = win.locator(".sidebar-section-title", { hasText: "对话" });
  await chatsTitle.click();
  await win.waitForTimeout(400);
  list = await win.locator(".thread-list").innerText();
  ok("折叠对话区后「新任务」隐藏", !list.includes("新任务"));
  await chatsTitle.click();

  await win.screenshot({ path: path.join(__dirname, "shots", "two-sections.png") });
  console.log(results.join("\n"));
  console.log(results.every((r) => r.startsWith("PASS")) ? "ALL PASS" : "SOME FAIL");
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
