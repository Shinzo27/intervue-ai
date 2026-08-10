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
}
