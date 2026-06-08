const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  buildCacheProfile,
  cacheHealth,
  compareProfiles,
  fingerprint,
  sanitizeMcpConfig
} = require("./cache-profile.cjs");

test("fingerprint is stable across object key order", () => {
  assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }));
});

test("MCP secrets are excluded from cache profiles", () => {
  const sanitized = sanitizeMcpConfig({
    command: "server",
    env: { SECRET: "do-not-store" },
    headers: { Authorization: "secret" }
  });
  assert.deepEqual(sanitized, { command: "server" });
});

test("profile reports stable-prefix changes without including mode", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "deepseek-tide-profile-"));
  try {
    fs.writeFileSync(path.join(workspace, "AGENTS.md"), "first", "utf8");
    const before = buildCacheProfile({
      workspace,
      runtimeVersion: "0.8.53",
      model: "deepseek-v4-flash"
    });
    fs.writeFileSync(path.join(workspace, "AGENTS.md"), "second", "utf8");
    const after = buildCacheProfile({
      workspace,
      runtimeVersion: "0.8.53",
      model: "deepseek-v4-flash"
    });
    assert.notEqual(before.fingerprint, after.fingerprint);
    assert.deepEqual(compareProfiles(before, after), ["项目指令文件已变化"]);
    assert.equal("mode" in after.shape, false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("cache health uses cached and uncached input tokens", () => {
  assert.deepEqual(cacheHealth({ cached_tokens: 80, input_tokens: 20 }), {
    hitRate: 0.8,
    label: "稳定"
  });
  assert.equal(cacheHealth({}).label, "暂无数据");
});
