import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ac, owner, admin, recruiter, interviewer } from './permissions';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  baseURL: 'http://localhost:3000',

  trustedOrigins: ['http://localhost:3001'],

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: () => true,
      ac,
      roles: {
        owner,
        admin,
        recruiter,
        interviewer,
      },
    }),
  ],
});
