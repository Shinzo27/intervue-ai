"""Drives the MCP server over stdio (JSON-RPC via stdin/stdout) end-to-end:
initialize -> initialized -> tools/call on a real interview. Bounded: exits.
"""

import json
import subprocess
import sys
import threading
import queue

INTERVIEW_ID = "be414c63-ef73-4584-943d-a110a3973940"

proc = subprocess.Popen(
    ["pnpm.cmd", "exec", "tsx", "src/index.ts", "stdio"],
    cwd="E:/Projects/intervue-ai/services/ai-service",
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    encoding="utf-8",
)

lines = queue.Queue()


def reader():
    for line in proc.stdout:
        lines.put(line.strip())


threading.Thread(target=reader, daemon=True).start()

messages = [
    {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
        "protocolVersion": "2025-06-18", "capabilities": {},
        "clientInfo": {"name": "hermes-stdio-test", "version": "1.0"}}},
    {"jsonrpc": "2.0", "method": "notifications/initialized"},
    {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
        "name": "get_current_interview_state",
        "arguments": {"interviewId": INTERVIEW_ID}}},
]

try:
    for msg in messages:
        proc.stdin.write(json.dumps(msg) + "\n")
        proc.stdin.flush()

    seen = 0
    while seen < 2:  # expecting responses for id 1 and id 2
        try:
            line = lines.get(timeout=30)
        except queue.Empty:
            print("TIMEOUT waiting for stdio response")
            sys.exit(1)
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue
        if data.get("id") not in (1, 2):
            continue
        seen += 1

        if data["id"] == 1:
            info = data["result"]["serverInfo"]
            print(f"stdio initialize OK -> {info['name']} v{info['version']}")
        else:
            payload = json.loads(data["result"]["content"][0]["text"])
            r = payload["result"]
            print(f"stdio tools/call OK -> ok={payload['ok']} candidate={r['candidate']['name']}")
            print(f"  job={r['job']['title']} interview={r['interview']['status']} progress={r['progress']}")
    print("stdio transport: ALL GOOD")
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
