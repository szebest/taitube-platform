import { ErrorCodes } from './error-codes';
import type { Failure } from './failure';

/** The ingest gateway did not answer its control API: kicking a publisher can be tried again. */
export type LiveGatewayUnavailable = Failure<
  typeof ErrorCodes.LIVE_GATEWAY_UNAVAILABLE,
  { operation: string; cause?: unknown }
>;

export function liveGatewayUnavailable(operation: string, cause?: unknown): LiveGatewayUnavailable {
  return {
    code: ErrorCodes.LIVE_GATEWAY_UNAVAILABLE,
    message: 'Live gateway unavailable',
    operation,
    ...(cause === undefined ? {} : { cause }),
  };
}
