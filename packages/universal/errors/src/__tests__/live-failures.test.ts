import { ErrorCodes } from '../error-codes';
import { liveGatewayUnavailable } from '../live-failures';
import { RETRY_CLASS } from '../retry-class';

describe('@vp/errors: live failures', () => {
  it('reports an unreachable gateway as transient, with what it was doing', () => {
    const failure = liveGatewayUnavailable('kick', new Error('ECONNREFUSED'));

    expect(failure).toMatchObject({ code: ErrorCodes.LIVE_GATEWAY_UNAVAILABLE, operation: 'kick' });
    expect(RETRY_CLASS[failure.code]).toBe('transient');
  });
});
