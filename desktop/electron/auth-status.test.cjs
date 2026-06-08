const assert = require("node:assert/strict");
const test = require("node:test");
const { parseAuthStatus } = require("./auth-status.cjs");

test("missing credentials are not authenticated", () => {
  assert.deepEqual(
    parseAuthStatus("provider: deepseek\nactive source: missing\n"),
    { authenticated: false, source: "missing" }
  );
});

test("configured credentials are authenticated", () => {
  assert.deepEqual(
    parseAuthStatus("provider: deepseek\nactive source: config (last4: ...1234)\n"),
    { authenticated: true, source: "config (last4: ...1234)" }
  );
});

test("empty or malformed status is not authenticated", () => {
  assert.deepEqual(parseAuthStatus(""), {
    authenticated: false,
    source: "missing"
  });
});
