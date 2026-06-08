import tempfile
import unittest
from pathlib import Path

from whaletide.tools import ToolError, WorkspaceTools


class WorkspaceToolsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.tools = WorkspaceTools(self.root)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_write_read_replace_and_search(self) -> None:
        self.tools.write_file("src/demo.txt", "alpha\nbeta\n")
        self.assertIn("1: alpha", self.tools.read_file("src/demo.txt"))
        self.tools.replace_text("src/demo.txt", "beta", "gamma")
        self.assertIn("gamma", self.tools.search_text("gamma"))

    def test_rejects_workspace_escape(self) -> None:
        with self.assertRaises(ToolError):
            self.tools.read_file("../outside.txt")

    def test_replace_requires_single_match(self) -> None:
        self.tools.write_file("demo.txt", "same same")
        with self.assertRaises(ToolError):
            self.tools.replace_text("demo.txt", "same", "new")

    def test_edit_file_is_atomic(self) -> None:
        self.tools.write_file("demo.txt", "alpha\nbeta\n")
        self.tools.edit_file(
            "demo.txt",
            [
                {"old_text": "alpha", "new_text": "one"},
                {"old_text": "beta", "new_text": "two"},
            ],
        )
        self.assertEqual(
            (self.root / "demo.txt").read_text(encoding="utf-8"),
            "one\ntwo\n",
        )

        with self.assertRaises(ToolError):
            self.tools.edit_file(
                "demo.txt",
                [
                    {"old_text": "one", "new_text": "changed"},
                    {"old_text": "missing", "new_text": "nope"},
                ],
            )
        self.assertEqual(
            (self.root / "demo.txt").read_text(encoding="utf-8"),
            "one\ntwo\n",
        )


if __name__ == "__main__":
    unittest.main()
