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
