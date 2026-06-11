// 验证中英切换:清空用户数据后,界面 chrome 完全切英文、无中文残留;重载保持。
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

  // 清空用户数据 + 默认中文,确保侧栏只剩界面 chrome(排除中文用户数据干扰)
  await win.evaluate(() => {
    localStorage.setItem("deepseek-tide.desktop.projects.v1", "[]");
    localStorage.setItem("deepseek-tide.desktop.threads.v1", "[]");
    localStorage.setItem("deepseek-tide.desktop.lang.v1", "zh");
  });
  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1500);
  await win.getByRole("button", { name: "取消" }).click({ timeout: 2000 }).catch(() => {});

  const results = [];
  const ok = (n, c) => results.push((c ? "PASS " : "FAIL ") + n);
  const chrome = async () =>
    (await win.locator(".left-sidebar").innerText()) +
    "\n" +
    (await win.locator(".composer-wrap").innerText().catch(() => ""));

  let body = await chrome();
  ok("默认中文(「新对话」)", body.includes("新对话"));

  await win.locator(".lang-toggle").click();
  await win.waitForTimeout(600);
  body = await chrome();
  ok("切英文: New chat", body.includes("New chat"));
  ok("切英文: Add project", body.includes("Add project"));
  ok("切英文: Projects", /projects/i.test(body));
  ok("切英文: Chats", /chats/i.test(body));
  ok("切英文: Settings", body.includes("Settings"));
  // 语言按钮在英文模式下显示「中」(切回中文)是有意为之,排除它再查残留中文
  ok("界面 chrome 无残留中文(语言按钮除外)", !/[一-龥]/.test(body.replace(/中/g, "")));
  await win.screenshot({ path: path.join(__dirname, "shots", "english.png") });

  await win.locator(".sidebar-footer button").first().click().catch(() => {});
  await win.waitForTimeout(700);
  const dtext = await win.locator(".modal-card").innerText().catch(() => "");
  ok("向导英文(Connect your DeepSeek)", dtext.includes("Connect your DeepSeek"));
  ok("向导无残留中文", !/[一-龥]/.test(dtext));
  await win.screenshot({ path: path.join(__dirname, "shots", "english-onboard.png") });
  await win.getByRole("button", { name: "Cancel" }).click({ timeout: 2000 }).catch(() => {});

  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1500);
  await win.getByRole("button", { name: "Cancel" }).click({ timeout: 2000 }).catch(() => {});
  body = await chrome();
  ok("重载后仍英文且无中文", body.includes("New chat") && !/[一-龥]/.test(body.replace(/中/g, "")));

  await win.locator(".lang-toggle").click(); // 切回中文,清理
  await win.waitForTimeout(400);

  console.log(results.join("\n"));
  console.log(results.every((r) => r.startsWith("PASS")) ? "ALL PASS" : "SOME FAIL");
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
