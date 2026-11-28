/** Public base URL of the candidate portal (used to build interview links). */
export const CANDIDATE_PORTAL_URL =
  process.env.NEXT_PUBLIC_CANDIDATE_PORTAL_URL ?? "http://localhost:3003";

export function interviewLink(inviteToken: string): string {
  return `${CANDIDATE_PORTAL_URL}/interview/${inviteToken}`;
}
