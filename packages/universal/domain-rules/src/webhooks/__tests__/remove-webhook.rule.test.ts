import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { decideWebhookRemoval } from '../remove-webhook.rule';

describe('@vp/domain-rules: decideWebhookRemoval', () => {
  it('accepts a removal that deleted a row', () => {
    expectOk(decideWebhookRemoval({ webhookId: 'w1', removed: true }));
  });

  it('is not found when nothing of the caller went', () => {
    expect(expectErr(decideWebhookRemoval({ webhookId: 'w1', removed: false }))).toMatchObject({
      code: ErrorCodes.WEBHOOK_NOT_FOUND,
      webhookId: 'w1',
    });
  });
});
