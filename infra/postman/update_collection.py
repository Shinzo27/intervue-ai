"""Extend the Intervue AI Postman collection with Sprint 4/5 + internal API folders.

Keeps every existing request untouched. Appends:
  11 - Sprint 4: Candidates & Applications
  12 - Sprint 5: Interview Runtime
  13 - Sprint 5: Conversation
  14 - Sprint 5: Evaluation & Scoring (mock evaluator)
  15 - Sprint 5: Decisions & Overrides
  16 - Internal API (ai-service capability surface)  [service-token auth]
Adds the collection variables the new requests chain on.
"""

import json
import re
import shutil
from pathlib import Path

SRC = Path(r"C:/Users/PRATHAM/Downloads/Intervue_AI_Production_Grade_CORRECTED.postman_collection.json")
REPO_COPY = Path(r"E:/Projects/intervue-ai/infra/postman/Intervue_AI.postman_collection.json")

collection = json.loads(SRC.read_text(encoding="utf-8"))

# ----------------------------------------------------------------- variables

NEW_VARS = {
    "internalBaseUrl": "http://localhost:3000/api/internal",
    "internalServiceSecret": "PASTE_INTERNAL_SERVICE_SECRET",
    "candidateId": "",
    "applicationId": "",
    "candidateToken": "",
    "interviewId": "",
    "answerId": "",
    "evaluationId": "",
    "currentQuestionVersionId": "",
    "nextQuestionVersionId": "",
}

existing = {v["key"] for v in collection.get("variable", [])}
collection.setdefault("variable", [])
for key, value in NEW_VARS.items():
    if key not in existing:
        collection["variable"].append({"key": key, "value": value, "type": "string"})

# ------------------------------------------------------------------- helpers

def url(path, **kw):
    base = kw.get("base", "{{baseUrl}}")
    u = {
        "raw": f"{base}{path}",
        "host": [base],
        "path": [p for p in path.split("/") if p],
    }
    if kw.get("query"):
        u["query"] = kw["query"]
    return u


def body(raw):
    return {
        "mode": "raw",
        "raw": json.dumps(raw, indent=2),
        "options": {"raw": {"language": "json"}},
    }


def req(method, path, *, headers=None, json_body=None, desc=None, base="{{baseUrl}}", query=None):
    r = {"method": method, "url": url(path, base=base, query=query), "header": headers or []}
    if json_body is not None:
        r["body"] = body(json_body)
        r["header"] = (r["header"] + [{"key": "Content-Type", "value": "application/json"}])
    if desc:
        r["description"] = desc
    return {"request": r}


def tests(*lines):
    script = "\n".join(
        [
            "pm.test('Status is expected', () => { pm.expect(pm.response.code).to.be.oneOf(statuses); });",
        ]
        + list(lines)
    )
    return [
        {"listen": "test", "script": {"type": "text/javascript", "exec": ["const statuses = STATUS;", script]}}
    ]


def item(name, request, *, statuses=(200, 201), script_lines=()):
    it = {"name": name}
    it.update(request)
    events = tests()
    events[0]["script"]["exec"] = [f"const statuses = {list(statuses)};"] + list(script_lines)
    it["event"] = events
    return it


def folder(name, description, items):
    return {"name": name, "description": description, "item": items}


JSON_OK = [
    "pm.test('JSON body', () => { pm.response.to.have.jsonBody(); });",
]

# ------------------------------------------------------- 11: Sprint 4 flows

f11 = folder(
    "11 - Sprint 4: Candidates & Applications",
    "Candidate identity, applications, invite tokens, candidate interview entry. No candidate account required.",
    [
        item(
            "Create Candidate",
            req("POST", "/api/candidates", json_body={"firstName": "Ada", "lastName": "Lovelace", "email": "ada.lovelace@example.com"}),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('candidate id returned', () => { pm.expect(b.data).to.have.property('id'); });",
                "pm.collectionVariables.set('candidateId', b.data.id);",
            ],
        ),
        item(
            "List Candidates",
            req("GET", "/api/candidates"),
        ),
        item(
            "Create Application (candidate + job)",
            req("POST", "/api/applications", json_body={"candidateId": "{{candidateId}}", "jobPostingId": "{{jobPostingId}}"}),
            script_lines=[
                "const b = pm.response.json();",
                "pm.collectionVariables.set('applicationId', b.data.id);",
            ],
        ),
        item(
            "Invite Candidate (creates candidate + application + token)",
            req("POST", "/api/applications/invite", json_body={"firstName": "Grace", "lastName": "Hopper", "email": "grace.hopper@example.com", "jobPostingId": "{{jobPostingId}}"}),
            script_lines=[
                "const b = pm.response.json();",
                "const d = b.data || b;",
                "const token = d.inviteToken || (d.application && d.application.inviteToken) || '';",
                "pm.test('invite token returned', () => { pm.expect(token).to.be.a('string').that.is.not.empty; });",
                "pm.collectionVariables.set('candidateToken', token);",
                "if (d.id) { pm.collectionVariables.set('applicationId', d.id); }",
            ],
        ),
        item(
            "Candidate Entry By Token",
            req("GET", "/api/candidates/entry?token={{candidateToken}}"),
            statuses=(200,),
            script_lines=JSON_OK,
        ),
        item(
            "Candidate Entry Start (mark STARTED)",
            req("POST", "/api/candidates/entry/start", json_body={"token": "{{candidateToken}}"}),
            statuses=(200, 201),
        ),
        item(
            "Expired / Invalid Token - Expected 401",
            req("GET", "/api/candidates/entry?token=invalid-token-value"),
            statuses=(401, 404),
        ),
    ],
)

# --------------------------------------------------- 12: Sprint 5 interview runtime

f12 = folder(
    "12 - Sprint 5: Interview Runtime",
    "Interview session lifecycle: create, candidate access, start, answer, progression.",
    [
        item(
            "Create Interview Session",
            req("POST", "/api/interviews", json_body={"applicationId": "{{applicationId}}"}),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('interview id returned', () => { pm.expect(b.data).to.have.property('id'); });",
                "pm.collectionVariables.set('interviewId', b.data.id);",
            ],
        ),
        item(
            "Duplicate Interview - Expected 400",
            req("POST", "/api/interviews", json_body={"applicationId": "{{applicationId}}"}),
            statuses=(400, 409),
        ),
        item(
            "Candidate Access (by token)",
            req("GET", "/api/interviews/access/{{candidateToken}}"),
            statuses=(200,),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('current stage present', () => { pm.expect(b.data.currentStage).to.exist; });",
            ],
        ),
        item(
            "Start Interview",
            req("POST", "/api/interviews/{{interviewId}}/start"),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('interview IN_PROGRESS', () => { pm.expect(b.data.status).to.eql('IN_PROGRESS'); });",
            ],
        ),
        item(
            "Start Interview Again - Expected 400",
            req("POST", "/api/interviews/{{interviewId}}/start"),
            statuses=(400,),
        ),
        item(
            "Get Current Interview (stage + questions)",
            req("GET", "/api/interviews/{{interviewId}}/current"),
            script_lines=[
                "const b = pm.response.json();",
                "const qs = b.data.stage.questions || [];",
                "pm.test('stage has questions', () => { pm.expect(qs.length).to.be.above(0); });",
                "pm.collectionVariables.set('currentQuestionVersionId', qs[0].id);",
            ],
        ),
        item(
            "Submit Answer (drives progression)",
            req("POST", "/api/interviews/{{interviewId}}/answers", json_body={"questionId": "{{currentQuestionVersionId}}", "content": "SQL databases are relational with ACID guarantees; NoSQL trades those for horizontal scale and flexible schemas."}),
            script_lines=[
                "const b = pm.response.json();",
                "const d = b.data;",
                "pm.test('progression flags present', () => {",
                "  pm.expect(d).to.have.property('stageCompleted');",
                "  pm.expect(d).to.have.property('interviewCompleted');",
                "});",
                "if (d.answer && d.answer.id) { pm.collectionVariables.set('answerId', d.answer.id); }",
                "if (d.nextQuestion) { pm.collectionVariables.set('currentQuestionVersionId', d.nextQuestion.id); }",
            ],
        ),
        item(
            "Duplicate Answer - Expected 400",
            req("POST", "/api/interviews/{{interviewId}}/answers", json_body={"questionId": "{{currentQuestionVersionId}}", "content": "duplicate submission"}),
            statuses=(400,),
        ),
        item(
            "Cross-Stage Answer - Expected 400",
            req("POST", "/api/interviews/{{interviewId}}/answers", json_body={"questionId": "not-in-current-stage", "content": "too early"}),
            statuses=(400, 404),
        ),
        item(
            "Complete Interview (answer-driven flow normally auto-completes)",
            req("POST", "/api/interviews/{{interviewId}}/complete"),
            statuses=(200, 201, 400),
        ),
    ],
)

# ------------------------------------------------------ 13: conversation

f13 = folder(
    "13 - Sprint 5: Conversation",
    "Conversation + messages runtime (foundation for the AI interviewer).",
    [
        item(
            "Create Conversation",
            req("POST", "/api/interviews/{{interviewId}}/conversation"),
            statuses=(200, 201, 400),
        ),
        item(
            "Append Assistant Message",
            req("POST", "/api/interviews/{{interviewId}}/conversation/messages", json_body={"role": "ASSISTANT", "content": "Explain SQL vs NoSQL databases."}),
        ),
        item(
            "Append Candidate Message",
            req("POST", "/api/interviews/{{interviewId}}/conversation/messages", json_body={"role": "CANDIDATE", "content": "SQL is relational with ACID; NoSQL scales horizontally."}),
        ),
        item(
            "Invalid Role - Expected 400",
            req("POST", "/api/interviews/{{interviewId}}/conversation/messages", json_body={"role": "SYSTEM", "content": "not allowed"}),
            statuses=(400,),
        ),
        item(
            "Get Conversation (ordered transcript)",
            req("GET", "/api/interviews/{{interviewId}}/conversation"),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('messages ordered ascending', () => {",
                "  const t = (b.data.messages || []).map(function (m) { return m.createdAt; });",
                "  const s = t.slice().sort();",
                "  pm.expect(t).to.eql(s);",
                "});",
            ],
        ),
    ],
)

# --------------------------------------------- 14: evaluation & scoring (mock)

f14 = folder(
    "14 - Sprint 5: Evaluation & Scoring (mock evaluator)",
    "Current mock evaluator (length-based). Phase 4 replaces the engine with the two-model LLM pipeline over the same data model.",
    [
        item(
            "Evaluate Answer (mock scoring)",
            req("POST", "/api/interviews/{{interviewId}}/answers/{{answerId}}/evaluate"),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('evaluation completed with score', () => {",
                "  const e = b.data.evaluation || b.data;",
                "  pm.expect(e.status).to.eql('COMPLETED');",
                "});",
            ],
        ),
        item(
            "Re-Evaluate Same Answer - Expected 400",
            req("POST", "/api/interviews/{{interviewId}}/answers/{{answerId}}/evaluate"),
            statuses=(400,),
        ),
        item(
            "Create Decision (aggregated scores)",
            req("POST", "/api/interviews/{{interviewId}}/decision", json_body={"outcome": "PASS"}),
            statuses=(200, 201),
        ),
    ],
)

# ------------------------------------------------ 15: decisions & overrides

f15 = folder(
    "15 - Sprint 5: Decisions & Overrides",
    "One decision per application; human overrides preserve full history.",
    [
        item(
            "Human Override (previous outcome preserved)",
            req("POST", "/api/interviews/{{interviewId}}/decision/override", json_body={"newOutcome": "FAIL", "reason": "Strong production experience not captured by rubric."}),
            statuses=(200, 201, 403),
            script_lines=[
                "const b = pm.response.json();",
                "if (pm.response.code < 400) {",
                "  pm.test('override stores previous outcome', () => {",
                "    const o = b.data.override || b.data;",
                "    pm.expect(o).to.have.property('previousOutcome');",
                "  });",
                "}",
            ],
        ),
        item(
            "Override Same Outcome - Expected 400",
            req("POST", "/api/interviews/{{interviewId}}/decision/override", json_body={"newOutcome": "FAIL", "reason": "no-op"}),
            statuses=(400,),
        ),
    ],
)

# --------------------------------------------- 16: internal capability surface

INTERNAL_HEADERS = [
    {"key": "Authorization", "value": "Internal {{internalServiceSecret}}"},
]

f16 = folder(
    "16 - Internal API (ai-service capability surface)",
    "Service-to-service API consumed by MCP tools (Phase 1). Auth: Authorization: Internal <INTERNAL_SERVICE_SECRET>. "
    "Raw payloads (no success/data envelope). Set internalServiceSecret in collection variables.",
    [
        item(
            "Get Interview State (agent-facing)",
            req(
                "GET",
                "/interviews/{{interviewId}}/state",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
            ),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('state shape', () => {",
                "  pm.expect(b).to.have.property('interview');",
                "  pm.expect(b).to.have.property('progress');",
                "});",
                "if (b.question) { pm.collectionVariables.set('currentQuestionVersionId', b.question.id); }",
            ],
        ),
        item(
            "Get Transcript",
            req(
                "GET",
                "/interviews/{{interviewId}}/transcript",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
            ),
            script_lines=JSON_OK,
        ),
        item(
            "Append Message (with metadata)",
            req(
                "POST",
                "/interviews/{{interviewId}}/messages",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"role": "ASSISTANT", "content": "Tell us about a challenging project.", "metadata": {"source": "ai-service", "model": "gpt-4o-mini"}},
            ),
            script_lines=JSON_OK,
        ),
        item(
            "Submit Answer (internal flow, TRANSCRIPT type)",
            req(
                "POST",
                "/interviews/{{interviewId}}/answers",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"questionId": "{{currentQuestionVersionId}}", "content": "I built a distributed order-processing backend with idempotent workers and an outbox pattern."},
            ),
            script_lines=[
                "const b = pm.response.json();",
                "if (b.answer && b.answer.id) { pm.collectionVariables.set('answerId', b.answer.id); }",
                "if (b.nextQuestion) { pm.collectionVariables.set('currentQuestionVersionId', b.nextQuestion.id); }",
            ],
        ),
        item(
            "Missing Token - Expected 401",
            req("GET", "/interviews/{{interviewId}}/state", headers=[], base="{{internalBaseUrl}}"),
            statuses=(401,),
            script_lines=[
                "pm.test('guard message', () => {",
                "  pm.expect(pm.response.json().message).to.include('Internal service authorization required');",
                "});",
            ],
        ),
        item(
            "Wrong Token - Expected 401",
            req(
                "GET",
                "/interviews/{{interviewId}}/state",
                headers=[{"key": "Authorization", "value": "Internal wrong-secret"}],
                base="{{internalBaseUrl}}",
            ),
            statuses=(401,),
        ),
        item(
            "Create Evaluation (PENDING)",
            req(
                "POST",
                "/evaluations",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"interviewSessionId": "{{interviewId}}", "answerId": "{{answerId}}", "model": "openai/gpt-4o-mini"},
            ),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('evaluation is PENDING', () => { pm.expect(b.status).to.eql('PENDING'); });",
                "pm.collectionVariables.set('evaluationId', b.id);",
            ],
        ),
        item(
            "Complete Evaluation",
            req(
                "PATCH",
                "/evaluations/{{evaluationId}}/complete",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"score": 7, "reasoning": "solid fundamentals across criteria", "result": {"criteria": []}},
            ),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('evaluation COMPLETED', () => { pm.expect(b.status).to.eql('COMPLETED'); });",
            ],
        ),
        item(
            "Double Complete - Expected 400",
            req(
                "PATCH",
                "/evaluations/{{evaluationId}}/complete",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"score": 1},
            ),
            statuses=(400,),
        ),
        item(
            "Fail Evaluation (second model path)",
            req(
                "POST",
                "/evaluations",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"interviewSessionId": "{{interviewId}}", "answerId": "{{answerId}}", "model": "groq/llama-3.3-70b"},
            ),
            script_lines=[
                "const b = pm.response.json();",
                "pm.collectionVariables.set('evaluationId', b.id);",
            ],
        ),
        item(
            "Fail Evaluation - FAILED (no score written)",
            req(
                "PATCH",
                "/evaluations/{{evaluationId}}/fail",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"error": "llm timeout", "result": {"attempt": 1}},
            ),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('evaluation FAILED', () => { pm.expect(b.status).to.eql('FAILED'); });",
            ],
        ),
        item(
            "Upsert Score (Score + CriterionScores, idempotent)",
            req(
                "POST",
                "/scores",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"applicationId": "{{applicationId}}", "questionVersionId": "{{currentQuestionVersionId}}", "overallScore": 7, "maxScore": 8, "reasoning": "two-model aggregated", "criteria": []},
            ),
            script_lines=JSON_OK,
        ),
        item(
            "Overall Above Max - Expected 400",
            req(
                "POST",
                "/scores",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"applicationId": "{{applicationId}}", "questionVersionId": "{{currentQuestionVersionId}}", "overallScore": 99, "maxScore": 8},
            ),
            statuses=(400,),
        ),
        item(
            "Application Score Summary",
            req(
                "GET",
                "/applications/{{applicationId}}/score-summary",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
            ),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('summary shape', () => {",
                "  pm.expect(b).to.have.property('totalScore');",
                "  pm.expect(b).to.have.property('maxScore');",
                "  pm.expect(b).to.have.property('percentage');",
                "});",
            ],
        ),
        item(
            "Complete Interview (idempotent)",
            req(
                "POST",
                "/interviews/{{interviewId}}/complete",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
            ),
            statuses=(200, 201),
            script_lines=JSON_OK,
        ),
        item(
            "Create Decision (AI recommendation + audit)",
            req(
                "POST",
                "/applications/{{applicationId}}/decision",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"outcome": "PASS", "totalScore": 15, "maxScore": 16, "reasoning": "meets the hiring bar", "requestedBy": "ai-service/two-model-aggregator"},
            ),
            statuses=(200, 201, 400),
            script_lines=JSON_OK,
        ),
        item(
            "Create Audit Event (AI actor)",
            req(
                "POST",
                "/audit-events",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                json_body={"organizationId": "{{organizationId}}", "actorType": "AI", "actorId": "ai-service/scoring-mcp", "action": "ANSWER_EVALUATED", "entityType": "AIEvaluation", "entityId": "{{evaluationId}}", "metadata": {"model": "openai/gpt-4o-mini", "tool": "evaluate_answer"}},
            ),
            script_lines=JSON_OK,
        ),
        item(
            "List Audit Events",
            req(
                "GET",
                "/audit/{{organizationId}}?limit=50",
                headers=INTERNAL_HEADERS,
                base="{{internalBaseUrl}}",
                query=[{"key": "limit", "value": "50"}],
            ),
            script_lines=[
                "const b = pm.response.json();",
                "pm.test('audit is an array', () => { pm.expect(Array.isArray(b)).to.be.true; });",
                "pm.test('AI actor events present', () => {",
                "  pm.expect(b.some(function (e) { return e.actorType === 'AI'; })).to.be.true;",
                "});",
            ],
        ),
    ],
)

# ------------------------------------------------------------------ append

for f in (f11, f12, f13, f14, f15, f16):
    collection["item"].append(f)

# Update collection description to reflect coverage.
info = collection.get("info", {})
info["description"] = (
    "Intervue AI API — full coverage: auth/RBAC, pipelines, jobs, snapshot workflow (Sprints 2–3), "
    "candidates/applications/invite tokens (Sprint 4), interview runtime/conversation/mock evaluation/"
    "decisions & overrides (Sprint 5), and the Internal capability surface for ai-service MCP tools (Phase 1). "
    "Folders 11+ chain collection variables; run in order. Internal folder requires "
    "internalServiceSecret from services/backend/.env."
)
collection["info"] = info

# ------------------------------------------------------------------ write

out = json.dumps(collection, indent=2, ensure_ascii=False) + "\n"
shutil.copy2(SRC, SRC.with_suffix(".pre-sprint45.bak.json"))
SRC.write_text(out, encoding="utf-8")
REPO_COPY.parent.mkdir(parents=True, exist_ok=True)
REPO_COPY.write_text(out, encoding="utf-8")

print("updated:", SRC)
print("repo copy:", REPO_COPY)
print("folders:", len(collection["item"]))
print("vars:", len(collection["variable"]))
