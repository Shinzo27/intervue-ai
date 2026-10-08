import { Permission } from '../auth/enums/permission.enum';
import { Role } from '../auth/enums/roles.enum';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    Permission.ORGANIZATION_MANAGE,
    Permission.MEMBERS_MANAGE,

    Permission.JOBS_CREATE,
    Permission.JOBS_UPDATE,
    Permission.JOBS_DELETE,
    Permission.JOBS_PUBLISH,
    Permission.JOBS_VIEW,

    Permission.PIPELINE_CREATE,
    Permission.PIPELINE_UPDATE,
    Permission.PIPELINE_DELETE,
    Permission.PIPELINE_VIEW,

    Permission.CANDIDATE_VIEW,

    Permission.INTERVIEW_EVALUATE,

    Permission.DECISION_OVERRIDE,

    // Compliance surface: who (human or AI) did what in this organization.
    Permission.AUDIT_VIEW,
  ],

  [Role.ADMIN]: [
    Permission.MEMBERS_MANAGE,

    Permission.JOBS_CREATE,
    Permission.JOBS_UPDATE,
    Permission.JOBS_DELETE,
    Permission.JOBS_PUBLISH,
    Permission.JOBS_VIEW,

    Permission.PIPELINE_CREATE,
    Permission.PIPELINE_UPDATE,
    Permission.PIPELINE_DELETE,
    Permission.PIPELINE_VIEW,

    Permission.CANDIDATE_VIEW,

    Permission.INTERVIEW_EVALUATE,

    Permission.DECISION_OVERRIDE,
    Permission.AUDIT_VIEW,
  ],

  [Role.RECRUITER]: [
    Permission.JOBS_CREATE,
    Permission.JOBS_UPDATE,
    Permission.JOBS_PUBLISH,
    Permission.JOBS_VIEW,

    Permission.PIPELINE_CREATE,
    Permission.PIPELINE_UPDATE,
    Permission.PIPELINE_VIEW,

    Permission.CANDIDATE_VIEW,

    // §44: recruiters/admins own the hiring decision, so they may override it.
    Permission.DECISION_OVERRIDE,

    Permission.AUDIT_VIEW,
  ],

  [Role.INTERVIEWER]: [
    Permission.PIPELINE_VIEW,

    Permission.CANDIDATE_VIEW,

    Permission.INTERVIEW_EVALUATE,
  ],
};
