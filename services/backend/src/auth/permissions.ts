import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';

const statement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  ...defaultStatements,
});

export const admin = ac.newRole({
  ...defaultStatements,
});

export const recruiter = ac.newRole({
  organization: ['update'],
  member: ['create', 'update'],
  invitation: ['create', 'cancel'],
});

export const interviewer = ac.newRole({});
