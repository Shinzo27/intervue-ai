"""Executes the updated Postman collection's chain against the live backend.

Mirrors the collection order: health -> auth -> org -> pipeline -> stages ->
questions -> rubrics -> job publish -> invite -> interview runtime -> internal
capability surface. Verifies status codes and variable chaining, printing a
run report. Python stdlib only (urllib + cookiejar for Better Auth sessions).
"""

import json
import time
import urllib.error
import urllib.request
import http.cookiejar
from datetime import datetime, timezone

BASE = "http://localhost:3000"
RUN_TAG = str(int(time.time()))
INTERNAL_SECRET = None  # read from .env below

# Wait for the backend to be reachable before starting the chain.
for attempt in range(30):
    try:
        with urllib.request.urlopen(f"{BASE}/api/health", timeout=5) as r:
            if r.status == 200:
                print(f"backend ready (attempt {attempt + 1})")
                break
    except Exception:
        pass
    time.sleep(2)
else:
    raise SystemExit("backend did not become ready within 60s")

for line in open(r"E:/Projects/intervue-ai/services/backend/.env", encoding="utf-8"):
    if line.startswith("INTERNAL_SERVICE_SECRET="):
        INTERNAL_SERVICE_SECRET = line.split("=", 1)[1].strip().strip("\r")
        break

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

results = []


def call(name, method, path, body=None, headers=None, auth=False, expect=(200, 201)):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    # Better Auth rejects auth-route POSTs without an Origin header
    # (MISSING_OR_NULL_ORIGIN). The Postman collection sends the same header.
    if path.startswith("/api/auth"):
        req.add_header("Origin", "http://localhost:3001")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    status, payload = None, None
    try:
        with opener.open(req, timeout=60) as resp:
            status = resp.status
            payload = json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            payload = json.loads(e.read().decode() or "{}")
        except Exception:
            payload = {}
    ok = status in expect
    results.append((name, method, path, status, ok))
    print(f"{'PASS' if ok else 'FAIL'} {status} {method:6} {name}")
    if not ok:
        msg = ""
        if isinstance(payload, dict):
            msg = payload.get("message", "")
            if isinstance(msg, list):
                msg = ", ".join(msg)
        print(f"     -> {msg}")
    return payload


def require_id(value, label):
    if not value:
        raise SystemExit(f"ABORT: {label} was not set — cannot continue the chain")
    return value


def data_of(payload):
    """Public endpoints wrap in {success, data}; internal are raw."""
    if isinstance(payload, dict) and "data" in payload and "success" in payload:
        return payload["data"]
    return payload


# ---------------------------------------------------------------- 00 health

call("Health", "GET", "/api/health", expect=(200,))

# ------------------------------------------------------- 01 auth (fresh user)

email = f"runner-{RUN_TAG}@intervue.test"
call("Sign Up", "POST", "/api/auth/sign-up/email",
     body={"email": email, "password": "RunnerSecure!2026", "name": "Collection Runner"},
     expect=(200, 201))
call("Sign In", "POST", "/api/auth/sign-in/email",
     body={"email": email, "password": "RunnerSecure!2026"}, expect=(200,))

# ------------------------------------------------------- 02 organization

org = call("Create Organization", "POST", "/api/auth/organization/create",
           body={"name": "Runner Org", "slug": f"runner-org-{RUN_TAG}"})
org_id = require_id(data_of(org).get("id"), "organizationId")
call("Set Active Organization", "POST", "/api/auth/organization/set-active",
     body={"organizationId": org_id})

# ------------------------------------------------------------- 03 pipelines

pipe = data_of(call("Create Pipeline", "POST", "/api/pipelines", body={"name": "Backend Interview"}))
pipeline_id = require_id(pipe.get("id"), "pipelineId")
print(f"     pipelineId = {pipeline_id}")

# ---------------------------------------------------------- 04/05/06/07 stages

stage = data_of(call("Create Stage - Technical", "POST", f"/api/pipelines/{pipeline_id}/stages",
                     body={"name": "Technical", "order": 1}))
stage2 = data_of(call("Create Stage - Project", "POST", f"/api/pipelines/{pipeline_id}/stages",
                      body={"name": "Project Experience", "order": 2}))
stage_id = stage.get("id", "")

q1 = data_of(call("Create Question - SQL vs NoSQL", "POST", f"/api/stages/{stage_id}/questions",
                  body={"question": "Explain SQL vs NoSQL databases.", "type": "MULTI_LINE", "order": 1}))
q2 = data_of(call("Create Question - Rate Limiter", "POST", f"/api/stages/{stage_id}/questions",
                  body={"question": "How would you design a rate limiter?", "type": "MULTI_LINE", "order": 2}))
q3 = data_of(call("Create Question - Project (stage 2)", "POST", f"/api/stages/{stage2.get('id')}/questions",
                  body={"question": "Tell us about a challenging project you worked on.", "type": "MULTI_LINE", "order": 1}))

call("Create Rubric - Database Fundamentals", "POST", f"/api/stages/{stage_id}/questions/{q1.get('id')}/rubrics",
     body={"name": "Database fundamentals", "description": "SQL vs NoSQL trade-offs", "maxScore": 5})
call("Create Rubric - Clarity", "POST", f"/api/stages/{stage_id}/questions/{q1.get('id')}/rubrics",
     body={"name": "Clarity", "maxScore": 3})
call("Create Rubric - Production Experience", "POST", f"/api/stages/{stage2.get('id')}/questions/{q3.get('id')}/rubrics",
     body={"name": "Production experience", "maxScore": 5})

# ------------------------------------------------------------- 08 job publish

job = data_of(call("Create Job Posting - Draft", "POST", "/api/job-postings",
                   body={"title": "Backend Developer", "description": "Runner job", "pipelineId": pipeline_id}))
job_id = job.get("id", "")
call("Publish Job", "POST", f"/api/job-postings/{job_id}/publish", expect=(200, 201, 400))
call("Publish Again - Expected 409", "POST", f"/api/job-postings/{job_id}/publish", expect=(400, 409))

# --------------------------------------------- 09/10 invite + interview runtime

inv = call("Invite Candidate", "POST", "/api/applications/invite",
           body={"firstName": "Ada", "lastName": "Lovelace", "email": f"ada-{RUN_TAG}@intervue.test", "jobPostingId": job_id})
inv_data = data_of(inv)
token = inv_data.get("inviteToken") or (inv_data.get("application") or {}).get("inviteToken", "")
application_id = require_id(inv_data.get("id") or (inv_data.get("application") or {}).get("id", ""), "applicationId")
print(f"     token={token[:18]}... applicationId={application_id}")

iv = data_of(call("Create Interview", "POST", "/api/interviews", body={"applicationId": application_id}))
interview_id = require_id(iv.get("id"), "interviewId")
print(f"     interviewId = {interview_id}")

call("Start Interview", "POST", f"/api/interviews/{interview_id}/start")

cur = data_of(call("Get Current Interview", "GET", f"/api/interviews/{interview_id}/current"))
stage_questions = (cur.get("stage") or {}).get("questions") or []
answers_submitted = 0
interview_completed = False
first_answer_id = None
for q in stage_questions:
    ans = data_of(call("Submit Answer", "POST", f"/api/interviews/{interview_id}/answers",
                       body={"questionId": q.get("id"),
                             "content": ("SQL databases are relational, provide ACID guarantees and fit structured data "
                                         "with complex joins, while NoSQL trades some guarantees for horizontal scale, "
                                         "flexible schemas and high write throughput.") if answers_submitted == 0 else
                                        ("I built a distributed order-processing backend on Node.js and PostgreSQL with "
                                         "idempotent workers over BullMQ, outbox-pattern events and p95 under 120ms at 2k rps.")}))
    answers_submitted += 1
    if ans.get("answer", {}).get("id") and first_answer_id is None:
        first_answer_id = ans["answer"]["id"]
    interview_completed = bool(ans.get("interviewCompleted"))
    if ans.get("nextQuestion"):
        nxt = data_of(call("Get Current Interview", "GET", f"/api/interviews/{interview_id}/current"))
    if interview_completed:
        break
first_answer_id = require_id(first_answer_id, "answerId")
first_question_id = require_id(stage_questions[0].get("id"), "questionVersionId")
print(f"     answers submitted: {answers_submitted}, interviewCompleted: {interview_completed}")

# ------------------------------------------ 16 internal capability surface

IH = {"Authorization": f"Internal {INTERNAL_SERVICE_SECRET}"}


def icall(name, method, path, body=None, expect=(200, 201)):
    return data_of(call(name, method, f"/api/internal{path}", body=body, headers=IH, expect=expect))


state = icall("Internal: Interview State", "GET", f"/interviews/{interview_id}/state")
print(f"     state: stage={state.get('stage', {}).get('name') if state.get('stage') else None}, progress={state.get('progress')}")

icall("Internal: Transcript", "GET", f"/interviews/{interview_id}/transcript")
# A Conversation row must exist before messages can be appended (same as
# collection folder 13: create conversation, then append messages).
call("Create Conversation", "POST", f"/api/interviews/{interview_id}/conversation")
icall("Internal: Append Message", "POST", f"/interviews/{interview_id}/messages",
      body={"role": "ASSISTANT", "content": "Thank you for your answers.", "metadata": {"source": "runner"}})

# Evaluation lifecycle — two-model pattern: one PENDING evaluation per model.
ev_a = icall("Internal: Create Evaluation (model A)", "POST", "/evaluations",
             body={"interviewSessionId": interview_id, "answerId": first_answer_id,
                   "model": "openai/gpt-4o-mini"})
eval_a_id = require_id(ev_a.get("id"), "evaluationIdA")
icall("Internal: Complete Evaluation (model A)", "PATCH", f"/evaluations/{eval_a_id}/complete",
      body={"score": 7, "reasoning": "solid fundamentals", "result": {"criteria": []}})
icall("Internal: Double Complete - Expected 400", "PATCH", f"/evaluations/{eval_a_id}/complete",
      body={"score": 1}, expect=(400,))

ev_b = icall("Internal: Create Evaluation (model B)", "POST", "/evaluations",
             body={"interviewSessionId": interview_id, "answerId": first_answer_id,
                   "model": "groq/llama-3.3-70b"})
eval_b_id = require_id(ev_b.get("id"), "evaluationIdB")
icall("Internal: Fail Evaluation (model B)", "PATCH", f"/evaluations/{eval_b_id}/fail",
      body={"error": "runner-simulated llm timeout", "result": {"attempt": 1}})

# Score upsert — idempotent: the second call must return the same Score row.
sc1 = icall("Internal: Upsert Score", "POST", "/scores",
            body={"applicationId": application_id, "questionVersionId": first_question_id,
                  "overallScore": 7, "maxScore": 8, "reasoning": "runner two-model aggregate",
                  "criteria": []})
sc2 = icall("Internal: Upsert Score Again (same row)", "POST", "/scores",
            body={"applicationId": application_id, "questionVersionId": first_question_id,
                  "overallScore": 7, "maxScore": 8})
if sc1.get("id") and sc2.get("id"):
    print(f"     upsert idempotent: {sc1['id'] == sc2['id']}")

summary = icall("Internal: Score Summary", "GET", f"/applications/{application_id}/score-summary")
print(f"     summary: total={summary.get('totalScore')}, max={summary.get('maxScore')}, pct={summary.get('percentage')}")

icall("Internal: Complete Interview (idempotent)", "POST", f"/interviews/{interview_id}/complete")

icall("Internal: Create Decision", "POST", f"/applications/{application_id}/decision",
      body={"outcome": "PASS", "totalScore": 7, "maxScore": 8,
            "reasoning": "runner decision", "requestedBy": "collection-runner"})

icall("Internal: Create Audit Event", "POST", "/audit-events",
      body={"organizationId": org_id, "actorType": "AI", "actorId": "collection-runner",
            "action": "RUNNER_SMOKE_TEST", "entityType": "Runner", "entityId": interview_id,
            "metadata": {"tag": RUN_TAG}})
audit = icall("Internal: List Audit", "GET", f"/audit/{org_id}")
print(f"     audit events: {len(audit) if isinstance(audit, list) else 'n/a'}")

# --------------------------------- second interview left IN_PROGRESS (MCP target)

inv2 = call("Invite Candidate B", "POST", "/api/applications/invite",
            body={"firstName": "Grace", "lastName": "Hopper",
                  "email": f"grace-{RUN_TAG}@intervue.test", "jobPostingId": job_id})
inv2_data = data_of(inv2)
application_id2 = require_id(
    inv2_data.get("id") or (inv2_data.get("application") or {}).get("id", ""),
    "applicationIdB")
iv2 = data_of(call("Create Interview B", "POST", "/api/interviews",
                   body={"applicationId": application_id2}))
interview_id2 = require_id(iv2.get("id"), "interviewIdB")
call("Start Interview B", "POST", f"/api/interviews/{interview_id2}/start")
print(f"     secondInterviewId = {interview_id2} (in-progress, 0 answers)")

# ------------------------------------------------------------------- report

passed = sum(1 for r in results if r[4])
failed = len(results) - passed
print("\n================ RUN REPORT ================")
print(f"total: {len(results)}  passed: {passed}  failed: {failed}")
for name, method, path, status, ok in results:
    if not ok:
        print(f"  FAIL {status} {method} {name}")
print("============================================")
