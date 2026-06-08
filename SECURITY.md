# Security Policy

## Reporting

Do not open a public issue for a vulnerability that could expose API keys,
session contents, local files, or command execution. Use GitHub's private
security advisory flow for this repository.

Include the affected version, operating system, reproduction steps, and the
smallest useful diagnostic output. Remove API keys, prompts, file contents,
usernames, and absolute paths before submitting.

## Product boundaries

- DeepSeek credentials are delegated to CodeWhale's user-level credential
  storage and are never written to project files or browser storage.
- Renderer IPC is limited to workspaces approved through the system directory
  picker.
- Imported external attachments are copied into the approved workspace before
  being passed to the agent.
- DeepSeek-Tide does not expose a local HTTP control API.
- Plan mode is read-only. Agent and YOLO behavior is enforced by CodeWhale;
  YOLO should only be used in a trusted workspace.

Only currently supported releases receive security fixes.
