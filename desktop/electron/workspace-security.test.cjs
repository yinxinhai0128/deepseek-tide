const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  canonicalDirectory,
  ensureDirectoryInside,
  isPathInside
} = require("./workspace-security.cjs");

test("path containment rejects sibling prefix and parent traversal", () => {
  const root = path.resolve("C:\\work");
  assert.equal(isPathInside(root, path.join(root, "src", "app.ts")), true);
  assert.equal(isPathInside(root, path.resolve("C:\\work-other\\secret.txt")), false);
  assert.equal(isPathInside(root, path.resolve("C:\\secret.txt")), false);
});

test("canonicalDirectory rejects files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deepseek-tide-workspace-"));
  try {
    const file = path.join(root, "file.txt");
    fs.writeFileSync(file, "content");
    assert.throws(() => canonicalDirectory(file), /目录/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("attachment directory remains in the canonical workspace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deepseek-tide-workspace-"));
  try {
    const directory = ensureDirectoryInside(root, path.join(root, ".deepseek-tide", "attachments"));
    assert.equal(isPathInside(canonicalDirectory(root), directory), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
