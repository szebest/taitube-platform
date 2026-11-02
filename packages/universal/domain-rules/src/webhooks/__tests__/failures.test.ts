import { ErrorCodes } from '@vp/errors';
import { webhookLimitReached, webhookNotFound } from '../failures';

describe('@vp/domain-rules: webhook failures', () => {
  it('names the webhook that was not found', () => {
    expect(webhookNotFound('w1')).toMatchObject({
      code: ErrorCodes.WEBHOOK_NOT_FOUND,
      webhookId: 'w1',
    });
  });

  it('names the cap that was reached', () => {
    expect(webhookLimitReached(10)).toMatchObject({
      code: ErrorCodes.WEBHOOK_LIMIT_REACHED,
      limit: 10,
    });
  });
});
