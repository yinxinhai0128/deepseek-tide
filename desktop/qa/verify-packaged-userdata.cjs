// 验证打包版(isPackaged=true)使用独立的 DeepSeek-Tide userData,而非开发版 deepseek-tide-desktop。
const { _electron } = require("playwright");
const path = require("path");

(async () => {
  const exe = path.resolve(__dirname, "..", "release", "win-unpacked", "DeepSeek-Tide.exe");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ executablePath: exe, args: [], env });
  const info = await app.evaluate(({ app: a }) => ({
    name: a.getName(),
    isPackaged: a.isPackaged,
    userData: a.getPath("userData")
  }));
  console.log(JSON.stringify(info, null, 2));
  const ok = a_ok(info);
  console.log(ok ? "PASS: 打包版使用独立 DeepSeek-Tide userData" : "FAIL: userData 命名空间不对");
  await app.close();
  function a_ok(i) {
    return i.isPackaged && i.name === "DeepSeek-Tide" && /DeepSeek-Tide$/.test(i.userData);
  }
})().catch((e) => { console.error(e); process.exit(1); });
