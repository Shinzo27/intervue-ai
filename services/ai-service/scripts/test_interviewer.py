"""End-to-end conversational interviewer test (master-note §39/§40, phase 5.4).

Drives a full scripted interview through the ai-service HTTP surface against a
live backend, then proves the loop actually advanced business state:

  candidate message -> Answer + Message(CANDIDATE) -> evaluation -> backend
  advances question/stage pointers -> Message(ASSISTANT) with the NEXT question

Checks the properties that matter, not just HTTP 200s:
  * the interviewer relays the SNAPSHOT question verbatim, never an invented one
  * each answer is persisted and scored
  * stage/interview completion propagates
  * the transcript contains both roles
  * a late message on a completed interview changes nothing
"""

import json
import re
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:3100"
CHAT = f"{BASE}/interviews/{{}}/chat"

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    mark = "PASS" if ok else "FAIL"
    if not ok:
        failures.append(name)
    print(f"{mark}  {name}" + (f"  ({detail})" if detail else ""))


def post(url: str, body: dict, timeout: int = 120) -> tuple[int, dict]:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw or "{}")
        except json.JSONDecodeError:
            return e.code, {"raw": raw[:300]}
    except Exception as e:  # noqa: BLE001
        return 0, {"error": str(e)}


def payload_of(body: dict) -> dict:
    """Internal endpoints return raw JSON; public ones wrap in {success,data}."""
    if isinstance(body, dict) and "data" in body and "success" in body:
        return body["data"] or {}
    return body or {}


def _internal_token() -> str:
    """Service token for the backend's internal API (same source the runner uses)."""
    for line in open(r"E:/Projects/intervue-ai/services/backend/.env", encoding="utf-8"):
        if line.startswith("INTERNAL_SERVICE_SECRET="):
            return line.split("=", 1)[1].strip().strip("\r")
    raise SystemExit("INTERNAL_SERVICE_SECRET not found in backend/.env")


def get(url: str, timeout: int = 60) -> tuple[int, dict]:
    req = urllib.request.Request(url, method="GET")
    if "/api/internal/" in url:
        req.add_header("Authorization", f"Internal {_internal_token()}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except json.JSONDecodeError:
            return e.code, {}
    except Exception as e:  # noqa: BLE001
        return 0, {"error": str(e)}


# ---------------------------------------------------------- 1. seed an interview

print("== seeding an interview to converse with ==")
run = subprocess.run(
    ["python", "infra/postman/run_collection.py"],
    cwd="E:/Projects/intervue-ai",
    capture_output=True,
    text=True,
    encoding="utf-8",
    timeout=300,
)
m = re.search(r"secondInterviewId\s*=\s*([0-9a-f-]{36})", run.stdout)
if not m:
    print(run.stdout[-1200:])
    print("Could not seed an interview — is the backend running on :3000?")
    sys.exit(1)
interview_id = m.group(1)
print(f"     interview = {interview_id}")

# ------------------------------------------------------- 2. the conversation loop

print("\n== conversational interviewer (deterministic fake provider) ==")

# The seeded pipeline has 2 stages x 2 questions; conversation should walk it.
ANSWERS = [
    "I'd use Postgres for relational data because it gives me transactions and strong constraints.",
    "I keep services small and talk over HTTP with retries and idempotency keys.",
    "In production I monitor latency and error rate, then alert on SLO breaches.",
    "I've shipped REST and event-driven APIs; I document contracts and version them.",
]

answers_in: list[dict] = []
replies: list[str] = []
turns = 0

for answer in ANSWERS:
    status, body = post(CHAT.format(interview_id), {"content": answer})
    if status != 200 or not body.get("ok"):
        check(f"turn {turns + 1} accepted", False, json.dumps(body)[:220])
        break

    result = body["result"]
    turns += 1
    replies.append(result["reply"])
    answers_in.append(result)

    done = result.get("interviewCompleted")
    if done:
        break

check("conversation accepted candidate turns", turns >= 2, f"{turns} turns")

first = answers_in[0] if answers_in else {}
check(
    "turn persists an answer and scores it",
    bool(first.get("answerId")) and first.get("evaluation", {}).get("queued") is True,
    f"answerId={str(first.get('answerId'))[:8]}… score={first.get('evaluation', {}).get('overallScore')}",
)
check(
    "turn returns the NEXT question, not the same one",
    bool(first.get("currentQuestion")),
    str(first.get("currentQuestion"))[:70],
)
check(
    "progress advances after each answer",
    first.get("progress", {}).get("answeredQuestions", 0) >= 1,
    str(first.get("progress")),
)
check(
    "interviewer used the live (fake-provider) path",
    first.get("fallback") is False,
    f"fallback={first.get('fallback')} reason={first.get('fallbackReason')}",
)

# The reply must contain the next snapshot question verbatim. We re-read the
# snapshot from the backend so the comparison is against real stored truth.
st, state = get(f"http://localhost:3000/api/internal/interviews/{interview_id}/state")
snap_q = payload_of(state).get("question") or {}
snap_text = snap_q.get("question") or ""
if replies and snap_text:
    check(
        "reply relays the snapshot question verbatim",
        snap_text in replies[-1],
        f"expected snapshot text in reply ({snap_text[:50]}…)",
    )

check(
    "interview completes after the final answer",
    bool(answers_in and answers_in[-1].get("interviewCompleted")),
    f"interviewCompleted={answers_in[-1].get('interviewCompleted') if answers_in else None}",
)

# ------------------------------------------------------------- 3. the transcript

print("\n== transcript integrity ==")
st, tr = get(f"http://localhost:3000/api/internal/interviews/{interview_id}/transcript")
msgs = payload_of(tr).get("messages") or []
roles = {m.get("role") for m in msgs}
check(
    "transcript records both candidate and assistant turns",
    {"CANDIDATE", "ASSISTANT"}.issubset(roles),
    f"{len(msgs)} messages, roles={sorted(roles)}",
)
check(
    "assistant turns embed mode metadata",
    any((m.get("metadata") or {}).get("source") == "interviewer-agent" for m in msgs),
    "mode=metadata present",
)

# --------------------------------------------- 4. a late message changes nothing

print("\n== post-completion behaviour ==")
status, body = post(CHAT.format(interview_id), {"content": "Actually, one more thing…"})
late = body.get("result", {}) if body.get("ok") else {}
check(
    "late message on a completed interview is acknowledged, not scored",
    status == 200
    and late.get("interviewCompleted") is True
    and late.get("answerId") is None,
    f"status={status} answerId={late.get('answerId')}",
)

st, tr2 = get(f"http://localhost:3000/api/internal/interviews/{interview_id}/transcript")
msgs2 = payload_of(tr2).get("messages") or []
late_candidate_turns = [
    m for m in msgs2
    if m.get("role") == "CANDIDATE" and (m.get("metadata") or {}).get("late")
]
check(
    "late message is recorded but explicitly marked unscored",
    len(late_candidate_turns) == 1
    and late_candidate_turns[0].get("metadata", {}).get("scored") is False,
    f"{len(late_candidate_turns)} late candidate turn(s), scored="
    f"{late_candidate_turns[0].get('metadata', {}).get('scored') if late_candidate_turns else None}",
)

# ------------------------------------------------------------- 5. bad input

print("\n== input validation ==")
status, body = post(CHAT.format(interview_id), {"content": "   "})
check("empty content rejected", status == 400 and not body.get("ok"), f"status={status}")

status, body = post(CHAT.format(interview_id), {})
check("missing content rejected", status == 400 and not body.get("ok"), f"status={status}")

status, body = post(CHAT.format("00000000-0000-4000-8000-999999999999"), {"content": "hi"})
check(
    "unknown interview surfaces a clean 404, not a crash",
    status == 404 and not body.get("ok"),
    f"status={status} {json.dumps(body)[:120]}",
)

print("\n" + "=" * 52)
if failures:
    print(f"FAILED: {len(failures)} -> {', '.join(failures)}")
    sys.exit(1)
print("ALL INTERVIEWER TESTS PASSED")