# DeepSeek-Tide Agent Guide

## Mission

DeepSeek-Tide is an independent terminal coding agent for DeepSeek and other
OpenAI-compatible Chat Completions APIs. Improve it as a focused, auditable
developer tool rather than a collection of loosely related AI features.

## Source And Licensing Boundaries

- Keep this project a clean-room implementation.
- Do not import leaked, private, source-available-only, or otherwise
  unauthorized code.
- Public MIT-licensed code may be incorporated only when its copyright and
  license notices are preserved and `THIRD_PARTY_NOTICES.md` is updated.
- Public behavior and architecture may be studied, but implement features in
  the style and abstractions already present in this repository.
- Never imply that DeepSeek-Tide is CodeWhale, Claude Code, or an official
  DeepSeek product.

## Repository Map

- `src/whaletide/`: canonical implementation.
- `whaletide/`: source-tree launcher only; do not duplicate implementation
  here.
- `tests/`: standard-library `unittest` coverage.
- `README.md`: user-facing setup, commands, behavior, and safety notes.
- `THIRD_PARTY_NOTICES.md`: provenance and attribution.

## Architecture Invariants

- The agent loop is: user message -> model response -> zero or more tool calls
  -> tool results -> next model response -> final answer.
- Persist messages after every state-changing step so interrupted sessions can
  resume without inventing history.
- Keep model transport, policy, tool execution, session storage, and CLI
  orchestration in separate modules.
- Treat model output and tool arguments as untrusted input.
- File tools must resolve paths against the configured workspace and reject
  escapes.
- `plan` is read-only. `agent` requires approval for writes and commands.
  `yolo` may auto-approve workspace actions but must not weaken path checks.
- Return command exit codes and output to the model. Never convert a failed
  command into a successful result.
- Preserve the OpenAI-compatible tool-call message shape unless a provider
  adapter explicitly translates it.
- Keep persisted records schema-versioned. Reject or migrate incompatible
  formats deliberately.

## Implementation Rules

- Target Python 3.11 or newer.
- Prefer the Python standard library. Ask before adding a runtime dependency,
  and explain what concrete complexity it removes.
- Use type hints on public functions and boundary data.
- Keep edits narrow. Avoid unrelated renames or architecture rewrites.
- Do not place API keys, tokens, user prompts, or session contents in logs,
  fixtures, commits, or error messages.
- Do not silently broaden shell access, network access, or filesystem scope.
- For new tools, add the schema, handler, policy classification, error
  behavior, and tests together.
- For new providers, preserve a small client interface instead of branching
  provider behavior throughout the agent loop.
- Update `README.md` when CLI flags, environment variables, modes, safety
  behavior, or installation steps change.

## Testing

Run these checks after code changes:

```powershell
python -m compileall -q src whaletide tests
python -m unittest discover -s tests -v
python -m whaletide --help
python -m whaletide --version
```

Testing expectations:

- Add a regression test for every bug fix.
- Prefer temporary directories for filesystem tests.
- Use fake clients for agent-loop tests; unit tests must not call live APIs.
- Test both allowed and denied policy paths for permission changes.
- Test workspace escape rejection for path-handling changes.
- Do not require a real `DEEPSEEK_API_KEY` for the default test suite.

## Definition Of Done

A change is complete only when:

- The requested behavior is implemented end to end.
- Relevant tests pass and new behavior has focused coverage.
- User-facing behavior is documented.
- Security and licensing boundaries remain intact.
- The final report names what changed and which verification commands ran.
