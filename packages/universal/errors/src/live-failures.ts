import { ErrorCodes } from './error-codes';
import { type Unavailable, unavailable } from './unavailable';

/** The ingest gateway did not answer its control API: kicking a publisher can be tried again. */
export type LiveGatewayUnavailable = Unavailable<typeof ErrorCodes.LIVE_GATEWAY_UNAVAILABLE>;

export const liveGatewayUnavailable = unavailable(
  ErrorCodes.LIVE_GATEWAY_UNAVAILABLE,
  'Live gateway unavailable'
);
