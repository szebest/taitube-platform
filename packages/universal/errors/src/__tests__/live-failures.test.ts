import { ErrorCodes } from '../error-codes';
import { liveGatewayUnavailable } from '../live-failures';
import { retryClass } from '../retry-class';

describe('@vp/errors: live failures', () => {
  it('reports an unreachable gateway as transient, with what it was doing', () => {
    const failure = liveGatewayUnavailable('kick', new Error('ECONNREFUSED'));

    expect(failure).toMatchObject({ code: ErrorCodes.LIVE_GATEWAY_UNAVAILABLE, operation: 'kick' });
    expect(retryClass(failure.code)).toBe('transient');
  });

  it('omits the cause when there is none', () => {
    expect(liveGatewayUnavailable('kick')).not.toHaveProperty('cause');
  });
});
