// 录制 README 动态 demo:注入演示数据,驱动真实 app 走一遍核心流程,连续截帧到 qa/frames。
const { _electron } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const framesDir = path.join(__dirname, "frames");
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const env = { ...process.env, WHALETIDE_USE_DIST: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], cwd: path.resolve(__dirname, ".."), env });
  const win = await app.firstWindow();
  win.on("dialog", (d) => d.accept().catch(() => {}));
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1500);

  // 注入演示数据:一个项目 + 已完成(带讲解小结)的对话
  await win.evaluate(() => {
    const now = Date.now();
    const proj = "C:\\Users\\demo\\我的网站";
    const summary =
      "好的,已经改好了。\n\n📝 小结\n我改了 1 个文件:`index.html`,把首页大标题的颜色从黑色改成了蓝色。因为你要求标题变蓝,所以我直接调整了标题样式,其它内容都没动,放心。";
    const threads = [
      {
        id: "d1", title: "把首页标题改成蓝色", workspace: proj, updatedAt: now,
        messages: [
          { id: "d1u", role: "user", content: "把首页标题改成蓝色", createdAt: now - 2000 },
          { id: "d1a", role: "assistant", content: summary, events: [], createdAt: now - 1000 }
        ]
      },
      { id: "d2", title: "给网站加一个联系我们页面", workspace: proj, updatedAt: now - 60000,
        messages: [{ id: "d2u", role: "user", content: "加联系页", createdAt: now - 60000 }] },
      { id: "d3", title: "帮我看看这段代码为什么报错", workspace: "C:\\Users\\demo\\草稿", updatedAt: now - 120000,
        messages: [{ id: "d3u", role: "user", content: "报错", createdAt: now - 120000 }] }
    ];
    localStorage.setItem("deepseek-tide.desktop.projects.v1", JSON.stringify([
      { path: proj, name: "我的网站", addedAt: now }
    ]));
    localStorage.setItem("deepseek-tide.desktop.threads.v1", JSON.stringify(threads));
  });
  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1800);
  await win.getByRole("button", { name: "取消" }).click({ timeout: 2000 }).catch(() => {});

  // 后台连续截帧
  let recording = true;
  let i = 0;
  const rec = (async () => {
    while (recording) {
      try { await win.screenshot({ path: path.join(framesDir, "f-" + String(i++).padStart(4, "0") + ".png") }); }
      catch {}
    }
  })();
  const hold = (ms) => win.waitForTimeout(ms);

  await hold(1600); // 主界面(两大区侧栏 + 空状态)
  // 点开"把首页标题改成蓝色" -> 展示讲解模式小结
  await win.locator(".thread-row", { hasText: "把首页标题改成蓝色" }).click().catch(() => {});
  await hold(3200); // 停久点让人读小结
  // 切到"性能" -> 花费
  await win.getByText("性能", { exact: true }).click().catch(() => {});
  await hold(2400);
  // 切回"变更"
  await win.getByText("变更", { exact: true }).click().catch(() => {});
  await hold(1200);
  // 打开开通向导
  await win.locator(".sidebar-footer button").first().click().catch(() => {});
  await hold(2800);
  await win.getByRole("button", { name: "取消" }).click({ timeout: 2000 }).catch(() => {});
  await hold(800);
  // 搜索
  await win.locator(".section-search-toggle").click().catch(() => {});
  await hold(500);
  await win.locator(".sidebar-search input").fill("联系").catch(() => {});
  await hold(1800);
  await win.locator(".sidebar-search input").fill("").catch(() => {});
  await win.locator(".section-search-toggle").click().catch(() => {});
  await hold(900);

  recording = false;
  await rec;
  console.log("frames:", i);
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
