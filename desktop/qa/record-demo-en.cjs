// 录制英文版 README demo:lang=en + 英文演示数据,流程同中文版。
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

  await win.evaluate(() => {
    const now = Date.now();
    const proj = "C:\\Users\\demo\\my-website";
    const summary =
      "Done — I've made the change.\n\n📝 Summary\nI changed 1 file: `index.html`. I switched the homepage title color from black to blue. Since you asked for a blue title, I only adjusted the title's style and left everything else untouched.";
    const threads = [
      {
        id: "d1", title: "Make the homepage title blue", workspace: proj, updatedAt: now,
        messages: [
          { id: "d1u", role: "user", content: "Make the homepage title blue", createdAt: now - 2000 },
          { id: "d1a", role: "assistant", content: summary, events: [], createdAt: now - 1000 }
        ]
      },
      { id: "d2", title: "Add a Contact Us page", workspace: proj, updatedAt: now - 60000,
        messages: [{ id: "d2u", role: "user", content: "add contact page", createdAt: now - 60000 }] },
      { id: "d3", title: "Help me fix this error", workspace: "C:\\Users\\demo\\scratch", updatedAt: now - 120000,
        messages: [{ id: "d3u", role: "user", content: "error", createdAt: now - 120000 }] }
    ];
    localStorage.setItem("deepseek-tide.desktop.lang.v1", "en");
    localStorage.setItem("deepseek-tide.desktop.projects.v1", JSON.stringify([
      { path: proj, name: "my-website", addedAt: now }
    ]));
    localStorage.setItem("deepseek-tide.desktop.threads.v1", JSON.stringify(threads));
  });
  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1800);
  await win.getByRole("button", { name: "Cancel" }).click({ timeout: 2000 }).catch(() => {});

  let recording = true;
  let i = 0;
  const rec = (async () => {
    while (recording) {
      try { await win.screenshot({ path: path.join(framesDir, "f-" + String(i++).padStart(4, "0") + ".png") }); }
      catch {}
    }
  })();
  const hold = (ms) => win.waitForTimeout(ms);

  await hold(1600);
  await win.locator(".thread-row", { hasText: "Make the homepage title blue" }).click().catch(() => {});
  await hold(3200);
  await win.getByText("Usage", { exact: true }).click().catch(() => {});
  await hold(2400);
  await win.getByText("Changes", { exact: true }).click().catch(() => {});
  await hold(1200);
  await win.locator(".sidebar-footer button").first().click().catch(() => {});
  await hold(2800);
  await win.getByRole("button", { name: "Cancel" }).click({ timeout: 2000 }).catch(() => {});
  await hold(800);
  await win.locator(".section-search-toggle").click().catch(() => {});
  await hold(500);
  await win.locator(".sidebar-search input").fill("contact").catch(() => {});
  await hold(1800);
  await win.locator(".sidebar-search input").fill("").catch(() => {});
  await win.locator(".section-search-toggle").click().catch(() => {});
  await hold(900);

  recording = false;
  await rec;
  console.log("frames:", i);
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
