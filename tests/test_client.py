import io
import json
import unittest

from whaletide.client import DeepSeekClient


def event(payload):
    return f"data: {json.dumps(payload)}\n\n".encode()


class ClientStreamTest(unittest.TestCase):
    def test_reassembles_text_reasoning_and_tool_fragments(self) -> None:
        response = io.BytesIO(
            b"".join(
                [
                    b": keep-alive\n\n",
                    event(
                        {
                            "choices": [
                                {"delta": {"reasoning_content": "inspect "}}
                            ]
                        }
                    ),
                    event({"choices": [{"delta": {"content": "Working. "}}]}),
                    event(
                        {
                            "choices": [
                                {
                                    "delta": {
                                        "tool_calls": [
                                            {
                                                "index": 0,
                                                "id": "call-1",
                                                "function": {
                                                    "name": "write_",
                                                    "arguments": '{"path":',
                                                },
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    ),
                    event(
                        {
                            "choices": [
                                {
                                    "delta": {
                                        "tool_calls": [
                                            {
                                                "index": 0,
                                                "function": {
                                                    "name": "file",
                                                    "arguments": '"a.txt"}',
                                                },
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    ),
                    event({"choices": [], "usage": {"total_tokens": 10}}),
                    b"data: [DONE]\n\n",
                ]
            )
        )
        seen = []

        message = DeepSeekClient._read_stream(
            response, lambda kind, value: seen.append((kind, value))
        )

        self.assertEqual(message["content"], "Working. ")
        self.assertEqual(message["reasoning_content"], "inspect ")
        self.assertEqual(
            message["tool_calls"][0]["function"],
            {"name": "write_file", "arguments": '{"path":"a.txt"}'},
        )
        self.assertIn(("keepalive", ""), seen)


if __name__ == "__main__":
    unittest.main()
