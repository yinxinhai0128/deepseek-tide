import json
import tempfile
import unittest
from pathlib import Path

from whaletide.agent import create_agent


class FakeClient:
    def __init__(self) -> None:
        self.calls = 0

    def complete(self, messages, tools, on_event=None):
        self.calls += 1
        if self.calls == 1:
            return {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call-1",
                        "type": "function",
                        "function": {
                            "name": "write_file",
                            "arguments": json.dumps(
                                {"path": "result.txt", "content": "done\n"}
                            ),
                        },
                    }
                ],
            }
        return {"role": "assistant", "content": "Task completed."}


class AgentTest(unittest.TestCase):
    def test_tool_loop_executes_and_returns_final_answer(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp)
            agent = create_agent(
                client=FakeClient(),
                workspace=workspace,
                mode="yolo",
                max_steps=4,
                continue_session=False,
                interactive=False,
            )

            result = agent.run("Create the result file.")

            self.assertEqual(result, "Task completed.")
            self.assertEqual(
                (workspace / "result.txt").read_text(encoding="utf-8"),
                "done\n",
            )
            self.assertTrue((workspace / ".whaletide/session.json").exists())


if __name__ == "__main__":
    unittest.main()
