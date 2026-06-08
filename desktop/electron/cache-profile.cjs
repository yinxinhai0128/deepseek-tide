const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", "REASONIX.md"];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function fingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function sanitizeMcpConfig(value) {
  if (Array.isArray(value)) return value.map(sanitizeMcpConfig);
  if (!value || typeof value !== "object") return value;
  const hidden = new Set(["apiKey", "api_key", "authorization", "env", "headers", "token"]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !hidden.has(key))
      .map(([key, child]) => [key, sanitizeMcpConfig(child)])
  );
}

function readProjectShape(workspace) {
  const instructions = {};
  for (const name of INSTRUCTION_FILES) {
    const filePath = path.join(workspace, name);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      instructions[name] = fingerprint(fs.readFileSync(filePath));
    }
  }

  let mcp = null;
  const mcpPath = path.join(workspace, ".mcp.json");
  if (fs.existsSync(mcpPath)) {
    try {
      mcp = sanitizeMcpConfig(JSON.parse(fs.readFileSync(mcpPath, "utf8")));
    } catch {
      mcp = { invalid: true };
    }
  }
  return { instructions, mcp };
}

function buildCacheProfile({ workspace, runtimeVersion, model }) {
  const shape = {
    schema: 1,
    runtimeVersion,
    model,
    project: readProjectShape(workspace)
  };
  return {
    fingerprint: fingerprint(shape),
    shape
  };
}

function compareProfiles(previous, current) {
  if (!previous) return ["首次记录前缀画像"];
  const reasons = [];
  if (previous.shape.runtimeVersion !== current.shape.runtimeVersion) {
    reasons.push("CodeWhale 版本已变化");
  }
  if (previous.shape.model !== current.shape.model) reasons.push("模型已变化");
  if (
    fingerprint(previous.shape.project.instructions) !==
    fingerprint(current.shape.project.instructions)
  ) {
    reasons.push("项目指令文件已变化");
  }
  if (fingerprint(previous.shape.project.mcp) !== fingerprint(current.shape.project.mcp)) {
    reasons.push("MCP 工具定义已变化");
  }
  return reasons;
}

function cacheHealth(totals = {}) {
  const cached = Number(totals.cached_tokens || 0);
  const input = Number(totals.input_tokens || 0);
  const denominator = cached + input;
  const hitRate = denominator ? cached / denominator : 0;
  return {
    hitRate,
    label: denominator === 0 ? "暂无数据" : hitRate >= 0.7 ? "稳定" : hitRate >= 0.35 ? "一般" : "偏低"
  };
}

module.exports = {
  buildCacheProfile,
  cacheHealth,
  canonicalize,
  compareProfiles,
  fingerprint,
  sanitizeMcpConfig
};
