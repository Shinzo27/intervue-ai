## Custom organization roles and RBAC

Better Auth's organization plugin is used for organization membership and role management.

The application uses four organization roles:

- Owner
- Admin
- Recruiter
- Interviewer

Better Auth handles the user's organization membership and role, while application-level RBAC maps those roles to specific permissions.

Authorization is enforced through NestJS guards and permission decorators rather than checking roles directly inside individual controllers.

This allows permissions to remain centralized and makes it possible to add or modify permissions without rewriting every protected endpoint.

RBAC was verified with an Owner and Recruiter:

- Owner was allowed to access an organization-management endpoint.
- Recruiter was correctly denied with HTTP 403.

## Pipeline templates and job snapshots

A Pipeline is an organization-level reusable template.

A JobPosting references a Pipeline template while it is being configured.

When a JobPosting is published, the Pipeline is frozen into a snapshot associated with that JobPosting.

Future changes to the reusable Pipeline template must not affect an already-published JobPosting or candidates evaluated against it.

This preserves the exact evaluation structure, questions, rubric criteria, weights, and thresholds used when the job was published.

## Sprint 4 — Candidate Entry Decisions

### Candidate Identity

Candidates are scoped to a single Application.

A Candidate record is created when an invitation is created and contains:

- first name
- last name
- email

Candidates do not have accounts.

The same person applying to multiple jobs may have multiple Candidate records. Cross-application candidate deduplication and identity resolution are intentionally out of scope for the MVP.

### Candidate Authentication

Candidates authenticate through possession of an application-specific invitation token.

Candidate authentication is intentionally separate from Better Auth.

Recruiters and organization members use:

- Better Auth
- sessions
- organization membership
- RBAC

Candidates use:

- invitation token
- token expiry
- application lifecycle validation

The candidate token is not single-use. It remains valid throughout the active application lifecycle so that candidates can leave and resume their interview later.

### Invitation Token

Invitation tokens are cryptographically random and stored against the Application.

Tokens have an expiration timestamp.

A candidate cannot access an application when:

- the token is invalid
- the token has expired
- the application is completed
- the application is decided

### Application Lifecycle

The Application lifecycle is:

INVITED → STARTED → IN_PROGRESS → COMPLETED → DECIDED

The `startedAt`, `completedAt`, and `decidedAt` timestamps record lifecycle transitions.

### Resume Upload

Resume upload is intentionally excluded from Sprint 4.

MinIO/object storage is therefore not introduced as part of candidate entry.

Sprint 4 focuses on identity, invitation, token-based candidate authentication, and candidate entry.

Resume storage, parsing, extraction, and semantic matching can be introduced later as separate functionality.

### Invitation Email

Candidate invitations are processed asynchronously.

Creating an invitation creates a BullMQ job rather than performing email delivery synchronously inside the HTTP request.

Redis is used as the BullMQ backing store.

The current processor validates the asynchronous architecture; integration with an external email provider is deferred.

### Candidate Entry

The candidate-facing entry flow is:

Open invitation link
→ validate token
→ resolve Application
→ retrieve candidate/job/frozen pipeline information
→ display pipeline overview
→ candidate chooses "Ready to Begin"
→ Application transitions from INVITED to STARTED

Full interview conversations, AI processing, scoring, and evaluation remain Sprint 5 responsibilities.
