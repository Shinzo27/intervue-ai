import { SetMetadata } from '@nestjs/common';

/**
 * Marks a handler so the global ResponseInterceptor passes its payload
 * through verbatim instead of wrapping it in `{ success, data }`.
 *
 * Used by service-to-service (internal) endpoints where callers want the
 * raw resource — while still keeping the standard envelope everywhere else.
 */
export const API_RESPONSE_FORMAT_KEY = 'apiResponseFormat';

export const ApiResponseFormat = () =>
  SetMetadata(API_RESPONSE_FORMAT_KEY, true);
