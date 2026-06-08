import unittest

from whaletide.policy import Policy


class PolicyTest(unittest.TestCase):
    def test_plan_allows_reads_and_denies_writes(self) -> None:
        policy = Policy("plan", interactive=False)
        self.assertTrue(policy.authorize("read_file", {"path": "README.md"}))
        self.assertFalse(policy.authorize("write_file", {"path": "README.md"}))
        self.assertFalse(policy.authorize("run_command", {"command": "echo hi"}))

    def test_yolo_allows_workspace_actions(self) -> None:
        policy = Policy("yolo", interactive=False)
        self.assertTrue(policy.authorize("write_file", {"path": "new.txt"}))
        self.assertTrue(policy.authorize("run_command", {"command": "echo hi"}))

    def test_yolo_rejects_dangerous_commands_by_default(self) -> None:
        policy = Policy("yolo", interactive=False)
        self.assertFalse(
            policy.authorize("run_command", {"command": "git reset --hard"})
        )
        self.assertFalse(
            policy.authorize(
                "run_command",
                {"command": "Remove-Item -Recurse -Force ."},
            )
        )

    def test_dangerous_override_is_explicit(self) -> None:
        policy = Policy("yolo", interactive=False, allow_dangerous=True)
        self.assertTrue(
            policy.authorize("run_command", {"command": "git reset --hard"})
        )


if __name__ == "__main__":
    unittest.main()
