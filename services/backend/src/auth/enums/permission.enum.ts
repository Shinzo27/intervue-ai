export enum Permission {
  ORGANIZATION_MANAGE = 'organization:manage',

  MEMBERS_MANAGE = 'members:manage',

  JOBS_CREATE = 'jobs:create',
  JOBS_UPDATE = 'jobs:update',
  JOBS_DELETE = 'jobs:delete',
  JOBS_VIEW = 'jobs:view',
  JOBS_PUBLISH = 'jobs:publish',
  JOBS_CLOSE = 'jobs:close',

  PIPELINE_CREATE = 'pipeline:create',
  PIPELINE_UPDATE = 'pipeline:update',
  PIPELINE_DELETE = 'pipeline:delete',
  PIPELINE_VIEW = 'pipeline:view',

  CANDIDATE_VIEW = 'candidate:view',

  INTERVIEW_EVALUATE = 'interview:evaluate',

  /**
   * Replace a persisted hiring decision with a different outcome.
   *
   * Deliberately distinct from INTERVIEW_EVALUATE: scoring an interview and
   * overriding a hiring decision are different levels of authority, and
   * master-note §44 gives the override to "Recruiter/Admin". Holding
   * `decision:override` is what makes a human override legitimate — the AI
   * actor can never hold it (see ai-service action/permissions.ts).
   */
  DECISION_OVERRIDE = 'decision:override',

  /**
   * Read the organization's audit trail (human + AI actions). Compliance and
   * debugging surface: who did what, when, and whether it was a human or the
   * AI actor.
   */
  AUDIT_VIEW = 'audit:view',
}
