import json
import tempfile
import unittest
from pathlib import Path

from whaletide.security import redact_text
from whaletide.session import SessionStore


class SecurityTest(unittest.TestCase):
    def test_redacts_api_keys(self) -> None:
        value = redact_text("use sk-1234567890abcdefghijkl and api_key=secret")
        self.assertNotIn("sk-1234567890abcdefghijkl", value)
        self.assertNotIn("api_key=secret", value)

    def test_session_never_persists_key(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            store = SessionStore(Path(temp))
            store.save(
                [{"role": "user", "content": "sk-1234567890abcdefghijkl"}]
            )
            raw = store.path.read_text(encoding="utf-8")
            self.assertNotIn("sk-1234567890abcdefghijkl", raw)

    def test_session_loads_legacy_whaleforge_history(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp)
            legacy = workspace / ".whaleforge" / "session.json"
            legacy.parent.mkdir()
            legacy.write_text(
                json.dumps({"schema_version": 1, "messages": [{"role": "user"}]}),
                encoding="utf-8",
            )

            store = SessionStore(workspace)

            self.assertEqual(store.load(), [{"role": "user"}])

    def test_session_loads_legacy_codetide_history(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp)
            legacy = workspace / ".codetide" / "session.json"
            legacy.parent.mkdir()
            legacy.write_text(
                json.dumps({"schema_version": 1, "messages": [{"role": "user"}]}),
                encoding="utf-8",
            )

            store = SessionStore(workspace)

            self.assertEqual(store.load(), [{"role": "user"}])


if __name__ == "__main__":
    unittest.main()
