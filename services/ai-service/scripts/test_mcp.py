"""One-command end-to-end test for the Intervue AI MCP server.

1. Seeds a fresh interview by running the Postman chain runner
   (infra/postman/run_collection.py) and grabbing its interviewId.
2. HTTP transport: health -> auth-401 -> initialize -> tools/list ->
   tools/call (fresh id) -> structured-404 (unknown id).
3. stdio transport: initialize -> tools/call over stdin/stdout.

Exit code 0 = everything passed.
"""

import json
import re
import subprocess
import sys
import threading
import queue
import urllib.error
import urllib.request

AI_SERVICE_DIR = "E:/Projects/intervue-ai/services/ai-service"
MCP = "http://127.0.0.1:3100/mcp"
TOKEN = "dev-mcp-token"
HEALTH = "http://127.0.0.1:3100/health"

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    mark = "PASS" if ok else "FAIL"
    print(f"{mark}  {name}" + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(name)


def rpc(method: str, id_: int | None = None, params: dict | None = None) -> dict:
    msg: dict = {"jsonrpc": "2.0", "method": method}
    if id_ is not None:
        msg["id"] = id_
    if params is not None:
        msg["params"] = params
    return msg


def post(body: dict, auth: bool = True) -> tuple[int, dict]:
    req = urllib.request.Request(
        MCP, data=json.dumps(body).encode(), method="POST"
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json, text/event-stream")
    if auth:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def tool_payload(response_body: dict) -> dict:
    """Unwrap {result:{content:[{text}]}} -> the JSON the tool returned."""
    return json.loads(response_body["result"]["content"][0]["text"])


# ---------------------------------------------------------- 1. seed an interview

print("== seeding a fresh interview via the chain runner ==")
run = subprocess.run(
    ["python", "infra/postman/run_collection.py"],
    cwd="E:/Projects/intervue-ai",
    capture_output=True,
    text=True,
    encoding="utf-8",
    timeout=240,
)
match = re.search(r"interviewId = ([0-9a-f-]{36})", run.stdout)
if not match:
    print(run.stdout[-1500:])
    print("Could not seed an interview — is the backend running on :3000?")
    sys.exit(1)
interview_id = match.group(1)  # completed interview (state checks)
match2 = re.search(r"secondInterviewId = ([0-9a-f-]{36})", run.stdout)
interview_id2 = match2.group(1) if match2 else interview_id  # in-progress
runner_ok = "failed: 0" in run.stdout
check("chain runner", runner_ok, f"completed={interview_id[:8]}… inprogress={interview_id2[:8]}…")

# ------------------------------------------------------------- 2. HTTP transport

print("\n== HTTP transport (:3100/mcp) ==")

try:
    with urllib.request.urlopen(HEALTH, timeout=10) as r:
        check("health endpoint", r.status == 200)
except Exception as e:  # noqa: BLE001
    check("health endpoint", False, str(e))
    print("MCP server not running? Start it: cd services/ai-service && pnpm dev")
    sys.exit(1)

status, _ = post(rpc("initialize", 1, {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {"name": "mcp-test", "version": "1.0"},
}), auth=False)
check("initialize without token -> 401", status == 401)

status, body = post(rpc("initialize", 1, {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {"name": "mcp-test", "version": "1.0"},
}))
check("initialize", status == 200 and body["result"]["serverInfo"]["name"] == "intervue-ai-mcp")

status, body = post(rpc("tools/list", 2))
tools = [t["name"] for t in body["result"]["tools"]]
check(
    "tools/list (all tools)",
    status == 200 and set(tools) == {
        "get_current_interview_state",
        "get_current_question",
        "get_stage_questions",
        "get_question_details",
        "get_interview_progress",
        "evaluate_answer",
        "get_application_scores",
    },
    ", ".join(sorted(tools)),
)

status, body = post(rpc("tools/call", 3, {
    "name": "get_current_interview_state",
    "arguments": {"interviewId": interview_id},
}))
payload = tool_payload(body)
r = payload["result"]
check(
    "tools/call returns real state",
    status == 200 and payload["ok"] and r["interview"]["id"] == interview_id,
    f"candidate={r['candidate']['name']} progress={r['progress']}",
)

status, body = post(rpc("tools/call", 4, {
    "name": "get_current_interview_state",
    "arguments": {"interviewId": "00000000-0000-4000-8000-999999999999"},
}))
err = tool_payload(body)["error"]
check(
    "unknown id -> structured 404",
    err["kind"] == "backend_error" and err["status"] == 404,
)

status, body = post(rpc("tools/call", 5, {
    "name": "get_current_interview_state",
    "arguments": {"interviewId": "not-a-uuid"},
}))
check(
    "invalid uuid rejected (schema)",
    body["result"].get("isError") is True and "-32602" in body["result"]["content"][0]["text"],
)

# ------------------------------------------------- 2b. Pipeline MCP toolset

print("\n== Pipeline MCP tools (in-progress interview) ==")

status, body = post(rpc("tools/call", 6, {
    "name": "get_current_question",
    "arguments": {"interviewId": interview_id2},
}))
cq = tool_payload(body)
check(
    "get_current_question",
    status == 200 and cq["ok"] and cq["result"]["question"]["id"],
    f"stage={cq['result']['stageName']} q=\"{cq['result']['question']['question'][:40]}…\"",
)
current_question_id = cq["result"]["question"]["id"]

status, body = post(rpc("tools/call", 7, {
    "name": "get_interview_progress",
    "arguments": {"interviewId": interview_id2},
}))
prog = tool_payload(body)["result"]
current_stages = [s for s in prog["stages"] if s["isCurrent"]]
check(
    "get_interview_progress",
    status == 200 and prog["progress"]["totalStages"] == 2 and len(current_stages) == 1,
    f"stages={[s['status'] for s in prog['stages']]}",
)
stage_version_id = current_stages[0]["pipelineStageVersionId"]

status, body = post(rpc("tools/call", 8, {
    "name": "get_stage_questions",
    "arguments": {"interviewId": interview_id2, "stageVersionId": stage_version_id},
}))
sq = tool_payload(body)["result"]
check(
    "get_stage_questions",
    status == 200 and len(sq["questions"]) == 2,
    f"q orders={[q['order'] for q in sq['questions']]}",
)

status, body = post(rpc("tools/call", 9, {
    "name": "get_question_details",
    "arguments": {"interviewId": interview_id2, "questionVersionId": current_question_id},
}))
qd = tool_payload(body)["result"]
check(
    "get_question_details",
    status == 200
    and qd["question"]["id"] == current_question_id
    and len(qd["rubricCriteria"]) >= 1,
    f"criteria={[(c['name'], c['maxScore']) for c in qd['rubricCriteria']]}",
)

status, body = post(rpc("tools/call", 10, {
    "name": "get_stage_questions",
    "arguments": {
        "interviewId": interview_id2,
        "stageVersionId": "00000000-0000-4000-8000-999999999999",
    },
}))
err = tool_payload(body)["error"]
check("unknown stage -> structured 404", err["kind"] == "backend_error" and err["status"] == 404)

# ------------------------------------------------------- 2c. Scoring MCP tools

print("\n== Scoring MCP tools ==")

match_ans = re.search(r"firstAnswerId=([0-9a-f-]{36})", run.stdout)
first_answer_id = match_ans.group(1) if match_ans else None
match_app = re.search(r"applicationId=([0-9a-f-]{36})", run.stdout)
application_id = match_app.group(1) if match_app else None

if first_answer_id:
    status, body = post(rpc("tools/call", 11, {
        "name": "evaluate_answer",
        "arguments": {"answerId": first_answer_id},
    }))
    ev = tool_payload(body)
    if ev["ok"]:
        res = ev["result"]
        check(
            "evaluate_answer (fake provider)",
            res["ok"] is True
            and res["overallScore"] is not None
            and res["needsHumanReview"] is False
            and len(res["modelResults"]) == 1
            and res["modelResults"][0]["status"] == "COMPLETED",
            f"score={res['overallScore']}/{res['maxScore']} models={[m['provider'] for m in res['modelResults']]}",
        )
    else:
        check("evaluate_answer (fake provider)", False, json.dumps(ev)[:200])

    # persisted score rows via the read tool
    status, body = post(rpc("tools/call", 12, {
        "name": "get_application_scores",
        "arguments": {"applicationId": application_id},
    }))
    rows = tool_payload(body)["result"]
    check(
        "get_application_scores",
        status == 200
        and isinstance(rows, list)
        and len(rows) >= 1
        and rows[0]["questionVersionId"]
        and rows[0]["criterionScores"],
        f"{len(rows)} row(s), {len(rows[0]['criterionScores']) if rows else 0} criteria",
    )

    # unknown answer -> structured 404 from the scoring loop
    status, body = post(rpc("tools/call", 14, {
        "name": "evaluate_answer",
        "arguments": {"answerId": "00000000-0000-4000-8000-999999999999"},
    }))
    err2 = tool_payload(body)["error"]
    check("unknown answer -> structured 404", err2["kind"] == "backend_error" and err2["status"] == 404)
else:
    check("scoring tools (firstAnswerId missing from runner output)", False)

# ------------------------------------------------------------ 3. stdio transport

print("\n== stdio transport ==")

proc = subprocess.Popen(
    ["pnpm.cmd", "exec", "tsx", "src/index.ts", "stdio"],
    cwd=AI_SERVICE_DIR,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.DEVNULL,
    text=True,
    encoding="utf-8",
)
lines: queue.Queue[str] = queue.Queue()
threading.Thread(target=lambda: [lines.put(l) for l in proc.stdout], daemon=True).start()

try:
    for msg in (
        rpc("initialize", 1, {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": "mcp-test", "version": "1.0"},
        }),
        rpc("notifications/initialized"),
        rpc("tools/call", 2, {
            "name": "get_current_interview_state",
            "arguments": {"interviewId": interview_id},
        }),
    ):
        proc.stdin.write(json.dumps(msg) + "\n")
        proc.stdin.flush()

    got_init = got_call = None
    deadline = 60
    import time

    start = time.time()
    while (got_init is None or got_call is None) and time.time() - start < deadline:
        try:
            data = json.loads(lines.get(timeout=deadline))
        except (queue.Empty, json.JSONDecodeError):
            continue
        if data.get("id") == 1 and "result" in data:
            got_init = data
        elif data.get("id") == 2 and "result" in data:
            got_call = data

    check("stdio initialize", got_init is not None)
    if got_call:
        p = tool_payload(got_call)
        check(
            "stdio tools/call",
            p["ok"] and p["result"]["interview"]["id"] == interview_id,
            f"candidate={p['result']['candidate']['name']}",
        )
    else:
        check("stdio tools/call", False, "no response within deadline")
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()

# ---------------------------------------------------------------------- summary

print("\n" + "=" * 52)
if failures:
    print(f"FAILED: {len(failures)} -> {', '.join(failures)}")
    sys.exit(1)
print("ALL MCP TESTS PASSED")
