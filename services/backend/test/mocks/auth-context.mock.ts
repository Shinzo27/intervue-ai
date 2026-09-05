import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

/**
 * E2E mock for `src/auth/utils/session` — the real module boots the entire
 * Better Auth stack at import time, which the service-token-guarded internal
 * API e2e does not need (it never calls session-authenticated endpoints).
 *
 * If a session-authenticated path is ever exercised in e2e, provide a valid
 * session by stubbing this further; otherwise it fails loudly.
 */
export async function getAuthContext(_request: Request) {
  throw new ForbiddenException(
    'getAuthContext is not available in the internal e2e bootstrap',
  );
}
