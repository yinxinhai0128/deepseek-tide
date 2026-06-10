// 验证对话搜索:注入测试项目/对话,按标题/内容/项目名过滤,空结果提示。
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

  // 注入种子数据
  await win.evaluate(() => {
    const now = Date.now();
    const mk = (id, title, ws, content) => ({
      id, title, workspace: ws, updatedAt: now,
      messages: [{ id: id + "m", role: "user", content, createdAt: now }]
    });
    const projects = [
      { path: "C:\\Demo\\alpha", name: "alpha", addedAt: now },
      { path: "C:\\Demo\\beta", name: "beta", addedAt: now }
    ];
    const threads = [
      mk("t1", "修复登录页样式", "C:\\Demo\\alpha", "把按钮改成蓝色"),
      mk("t2", "数据库迁移脚本", "C:\\Demo\\alpha", "写一个 migration"),
      mk("t3", "首页性能优化", "C:\\Demo\\beta", "懒加载图片 lazyload")
    ];
    localStorage.setItem("deepseek-tide.desktop.projects.v1", JSON.stringify(projects));
    localStorage.setItem("deepseek-tide.desktop.threads.v1", JSON.stringify(threads));
    localStorage.setItem("deepseek-tide.desktop.removed-projects.v1", "[]");
  });
  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1800);
  await win.getByRole("button", { name: "取消" }).click({ timeout: 2000 }).catch(() => {});

  const listText = () => win.locator(".thread-list").innerText();
  const shot = (n) => win.screenshot({ path: path.join(__dirname, "shots", n + ".png") });
  const results = [];
  const assert = (name, cond) => { results.push((cond ? "PASS " : "FAIL ") + name); };

  // 打开搜索
  await win.locator(".section-search-toggle").click();
  await win.waitForTimeout(300);

  // 1) 按对话标题搜
  await win.locator(".sidebar-search input").fill("登录");
  await win.waitForTimeout(400);
  let t = await listText();
  assert("标题搜「登录」命中 t1", t.includes("修复登录页样式"));
  assert("标题搜「登录」过滤掉 t2", !t.includes("数据库迁移脚本"));
  assert("标题搜「登录」隐藏 beta 项目", !t.includes("beta"));
  await shot("search-title");

  // 2) 按消息内容搜
  await win.locator(".sidebar-search input").fill("lazyload");
  await win.waitForTimeout(400);
  t = await listText();
  assert("内容搜「lazyload」命中 t3", t.includes("首页性能优化"));
  assert("内容搜「lazyload」隐藏 alpha", !t.includes("alpha"));

  // 3) 按项目名搜,展开该项目全部对话
  await win.locator(".sidebar-search input").fill("alpha");
  await win.waitForTimeout(400);
  t = await listText();
  assert("项目名搜「alpha」显示 t1", t.includes("修复登录页样式"));
  assert("项目名搜「alpha」显示 t2", t.includes("数据库迁移脚本"));

  // 4) 无匹配
  await win.locator(".sidebar-search input").fill("zzznomatch");
  await win.waitForTimeout(400);
  t = await listText();
  assert("无匹配显示空状态", t.includes("没有匹配"));
  await shot("search-empty");

  console.log(results.join("\n"));
  console.log(results.every((r) => r.startsWith("PASS")) ? "ALL PASS" : "SOME FAIL");
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
