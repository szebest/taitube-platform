import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

/** A caller's id is kept only when it cannot smuggle anything into a log line or a header. */
const CALLER_REQUEST_ID = /^[\w.:-]{1,128}$/;

export function requestIdFrom(headers: IncomingHttpHeaders): string {
  const given = headers[REQUEST_ID_HEADER];
  return typeof given === 'string' && CALLER_REQUEST_ID.test(given) ? given : randomUUID();
}
