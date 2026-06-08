function parseAuthStatus(output) {
  const match = String(output || "").match(/^active source:\s*(.+?)\s*$/im);
  const source = match?.[1]?.trim() || "missing";
  const authenticated = !/^missing(?:\s|$)/i.test(source);
  return { authenticated, source };
}

module.exports = { parseAuthStatus };
