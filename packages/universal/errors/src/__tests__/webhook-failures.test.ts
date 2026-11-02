import { ErrorCodes } from '../error-codes';
import { retryClass } from '../retry-class';
import { webhookDeliveryFailed, webhookDeliveryRejected } from '../webhook-failures';

describe('@vp/errors: webhook failures', () => {
  it.each([
    {
      name: 'failed',
      failure: webhookDeliveryFailed('w1', 'status', 503),
      code: ErrorCodes.WEBHOOK_DELIVERY_FAILED,
      expected: 'transient',
    },
    {
      name: 'rejected',
      failure: webhookDeliveryRejected('w1', 'redirect', 302),
      code: ErrorCodes.WEBHOOK_DELIVERY_REJECTED,
      expected: 'permanent',
    },
  ])('a $name delivery carries its code and is $expected', ({ failure, code, expected }) => {
    expect(failure).toMatchObject({ code, webhookId: 'w1' });
    expect(retryClass(failure.code)).toBe(expected);
  });

  it('omits the status when the receiver never answered', () => {
    expect(webhookDeliveryFailed('w1', 'timeout')).not.toHaveProperty('status');
    expect(webhookDeliveryRejected('w1', 'blocked-host')).not.toHaveProperty('status');
  });
});
