// 注入几条假对话,验证新空状态("最近的任务" + 居中)的视觉效果。
const { _electron } = require("playwright");
const path = require("path");

(async () => {
  const env = { ...process.env, WHALETIDE_USE_DIST: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], cwd: path.resolve(__dirname, ".."), env });
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(800);

  await win.evaluate(() => {
    const ws = "C:\\Users\\Yinxh\\Documents\\demo-project";
    const msg = (c) => ({ id: Math.random().toString(36).slice(2), role: "user", content: c });
    const threads = [
      { id: "new1", title: "新任务", workspace: ws, messages: [], updatedAt: 3000 },
      { id: "t1", title: "修复登录页的报错", workspace: ws, messages: [msg("修一下")], updatedAt: 2000 },
      { id: "t2", title: "给 README 加使用说明", workspace: ws, messages: [msg("写文档")], updatedAt: 1900 },
      { id: "t3", title: "实现一个简单的待办清单网页", workspace: ws, messages: [msg("做todo")], updatedAt: 1800 }
    ];
    localStorage.setItem("deepseek-tide.desktop.threads.v1", JSON.stringify(threads));
    localStorage.setItem(
      "deepseek-tide.desktop.projects.v1",
      JSON.stringify([{ path: ws, name: "demo-project", addedAt: 1 }])
    );
  });

  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1600);
  await win.screenshot({ path: path.join(__dirname, "shots", "p43-empty.png") });
  console.log("done");
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
