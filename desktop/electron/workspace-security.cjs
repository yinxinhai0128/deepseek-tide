const fs = require("node:fs");
const path = require("node:path");

function canonicalDirectory(value) {
  const resolved = fs.realpathSync.native(path.resolve(value));
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error("工作区必须是已存在的目录");
  }
  return resolved;
}

function isPathInside(base, candidate) {
  const relative = path.relative(base, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function ensureDirectoryInside(base, candidate) {
  const canonicalBase = canonicalDirectory(base);
  fs.mkdirSync(candidate, { recursive: true });
  const canonicalCandidate = fs.realpathSync.native(candidate);
  if (!isPathInside(canonicalBase, canonicalCandidate)) {
    throw new Error("附件目录超出工作区");
  }
  return canonicalCandidate;
}

module.exports = { canonicalDirectory, ensureDirectoryInside, isPathInside };
