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
    """Unwrap {result:{content:[{text}]}} -> the JSON the tool returned.

    A schema-level rejection (bad argument type) comes back from the MCP SDK
    as plain text rather than our JSON envelope, so surface it as a readable
    failure instead of killing the whole run with a JSONDecodeError.
    """
    try:
        text = response_body["result"]["content"][0]["text"]
    except (KeyError, IndexError, TypeError):
        return {"ok": False, "error": {"message": f"unexpected MCP envelope: {response_body}"}}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"ok": False, "error": {"message": f"non-JSON tool response: {text[:400]}"}}


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
EXPECTED_TOOLS = {
    # Pipeline MCP (read-only)
    "get_current_interview_state",
    "get_current_question",
    "get_stage_questions",
    "get_question_details",
    "get_interview_progress",
    # Scoring MCP
    "evaluate_answer",
    "get_application_scores",
    # Action MCP (permission-checked state changes)
    "advance_interview",
    "complete_interview",
    "create_decision",
    "request_human_review",
    "create_audit_event",
}
check(
    "tools/list (all tools)",
    status == 200 and set(tools) == EXPECTED_TOOLS,
    f"{len(tools)} tools; missing={sorted(EXPECTED_TOOLS - set(tools))} "
    f"unexpected={sorted(set(tools) - EXPECTED_TOOLS)}",
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
# The runner prints "organizationId = <uuid>" (with spaces) and also an
# "applicationIdC = <uuid>" line; anchor on the spaced form to avoid matching
# the wrong id.
match_org = re.search(r"organizationId\s*=\s*([A-Za-z0-9_-]{20,40})", run.stdout)
organization_id = match_org.group(1) if match_org else None

if first_answer_id:
    status, body = post(rpc("tools/call", 11, {
        "name": "evaluate_answer",
        "arguments": {"answerId": first_answer_id},
    }))
    ev = tool_payload(body)
    if ev["ok"]:
        res = ev["result"]
        # Provider-agnostic: assert the scoring CONTRACT, not how many models the
        # local .env happens to configure. Hardcoding len(...) == 1 made this fail
        # the moment a real two-model config was used, despite scoring correctly.
        models = res["modelResults"]
        model_ids = ",".join(
            str(m.get("provider", "?")) + ":" + str(m.get("model", "?")) for m in models
        )
        check(
            "evaluate_answer (real scoring path)",
            res["ok"] is True
            and res["overallScore"] is not None
            and res["needsHumanReview"] is False
            and len(models) >= 1
            and all(m["status"] == "COMPLETED" for m in models),
            f"score={res['overallScore']}/{res['maxScore']} models=[{model_ids}]",
        )
    else:
        check("evaluate_answer (real scoring path)", False, json.dumps(ev)[:200])

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

# ------------------------------------------------ 2b. Action MCP (state changes)

print("\n== Action MCP tools (permission-checked) ==")

if application_id:
    # advance_interview on the in-progress interview: must return the
    # backend-authoritative position without mutating anything itself.
    status, body = post(rpc("tools/call", 20, {
        "name": "advance_interview",
        "arguments": {"interviewId": interview_id2},
    }))
    payload = tool_payload(body)
    adv = payload.get("result", {})
    check(
        "advance_interview returns authoritative position",
        payload.get("ok") is True
        and adv.get("interviewId") == interview_id2
        and adv.get("status") == "IN_PROGRESS"
        and "currentStage" in adv
        and "progress" in adv,
        f"stage={(adv.get('currentStage') or {}).get('name')!r} "
        f"question={(adv.get('currentQuestion') or {}).get('order')}",
    )

    # Wrong-organization scope must be rejected by the permission layer (§64).
    status, body = post(rpc("tools/call", 21, {
        "name": "advance_interview",
        "arguments": {
            "interviewId": interview_id2,
            "expectedOrganizationId": "00000000-0000-4000-8000-000000000001",
        },
    }))
    payload = tool_payload(body)
    denied = payload.get("error", {})
    check(
        "advance_interview blocks cross-org scope",
        payload.get("ok") is False
        and "different organization" in str(denied.get("message", "")),
        str(denied.get("message", ""))[:80],
    )

    # advance on a COMPLETED interview must be refused (state validation).
    status, body = post(rpc("tools/call", 22, {
        "name": "advance_interview",
        "arguments": {"interviewId": interview_id},
    }))
    payload = tool_payload(body)
    check(
        "advance_interview rejects non-IN_PROGRESS interview",
        payload.get("ok") is False and "only IN_PROGRESS" in str(
            payload.get("error", {}).get("message", "")
        ),
        str(payload.get("error", {}).get("message", ""))[:80],
    )

    # request_human_review persists an auditable flag event.
    status, body = post(rpc("tools/call", 23, {
        "name": "request_human_review",
        "arguments": {
            "applicationId": application_id,
            "reason": "e2e: two-model disagreement beyond threshold",
        },
    }))
    payload = tool_payload(body)
    rev = payload.get("result", {})
    check(
        "request_human_review writes an audit-backed flag",
        payload.get("ok") is True
        and rev.get("requested") is True
        and rev.get("auditEventId"),
        f"auditEventId={str(rev.get('auditEventId'))[:8]}…",
    )

    # create_decision: threshold-derived PASS/FAIL from persisted scores.
    status, body = post(rpc("tools/call", 24, {
        "name": "create_decision",
        "arguments": {"applicationId": application_id, "thresholdPct": 70},
    }))
    payload = tool_payload(body)
    dec = payload.get("result", {})
    rec = dec.get("recommendation", {})
    check(
        "create_decision derives outcome from threshold",
        payload.get("ok") is True
        and rec.get("outcome") in ("PASS", "FAIL")
        and rec.get("thresholdPct") == 70
        and dec.get("decision", {}).get("id"),
        f"outcome={rec.get('outcome')} pct={rec.get('percentage')}",
    )

    # A second decision must be refused — the AI can never silently overwrite.
    status, body = post(rpc("tools/call", 25, {
        "name": "create_decision",
        "arguments": {"applicationId": application_id, "thresholdPct": 70},
    }))
    payload = tool_payload(body)
    err_dec = payload.get("error", {})
    check(
        "create_decision never overwrites an existing decision",
        payload.get("ok") is False and err_dec.get("status") == 400,
        str(err_dec.get("message", ""))[:80],
    )

    # complete_interview is idempotent.
    status, body = post(rpc("tools/call", 26, {
        "name": "complete_interview",
        "arguments": {"interviewId": interview_id},
    }))
    payload = tool_payload(body)
    res = payload.get("result", {})
    check(
        "complete_interview is idempotent",
        payload.get("ok") is True
        and res.get("alreadyCompleted") is True,
        f"status={res.get('status')}",
    )

    # create_audit_event writes an AI-attributed record.
    status, body = post(rpc("tools/call", 27, {
        "name": "create_audit_event",
        "arguments": {
            "organizationId": organization_id,
            "action": "E2E_ACTION_PROBE",
            "entityType": "InterviewSession",
            "entityId": interview_id2,
            "metadata": {"probe": True},
        },
    }))
    payload = tool_payload(body)
    ev = payload.get("result", {})
    check(
        "create_audit_event records tool+capability metadata",
        payload.get("ok") is True
        and ev.get("actorType") == "AI"
        and (ev.get("metadata") or {}).get("capability") == "audit:write"
        and (ev.get("metadata") or {}).get("tool") == "create_audit_event"
        and (ev.get("metadata") or {}).get("traceId"),
        f"action={ev.get('action')} metadata_keys={sorted((ev.get('metadata') or {}).keys())}",
    )
else:
    check("action tools (applicationId missing from runner output)", False)

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
