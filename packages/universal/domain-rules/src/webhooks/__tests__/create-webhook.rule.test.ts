import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { OWNER } from '../../__tests__/entities';
import { type CreateWebhookInput, decideWebhookCreate } from '../create-webhook.rule';

const NOW = new Date('2026-02-01T00:00:00.000Z');

function input(overrides: Partial<CreateWebhookInput> = {}): CreateWebhookInput {
  return {
    viewer: OWNER,
    url: 'https://hooks.example.com/in',
    events: ['video.ready'],
    held: 0,
    policy: { allowPrivateHosts: false },
    id: 'w1',
    secret: 's3cret',
    now: NOW,
    ...overrides,
  };
}

describe('@vp/domain-rules: decideWebhookCreate', () => {
  it('builds a webhook owned by the caller, with each event once', () => {
    expect(
      expectOk(
        decideWebhookCreate(input({ events: ['video.ready', 'live.started', 'video.ready'] }))
      )
    ).toEqual({
      id: 'w1',
      ownerId: OWNER.id,
      url: 'https://hooks.example.com/in',
      events: ['video.ready', 'live.started'],
      secret: 's3cret',
      createdAt: NOW,
    });
  });

  it('asks an anonymous caller to sign in', () => {
    expect(expectErr(decideWebhookCreate(input({ viewer: null })))).toMatchObject({
      code: ErrorCodes.UNAUTHORIZED,
    });
  });

  it('refuses the eleventh webhook', () => {
    expect(expectErr(decideWebhookCreate(input({ held: 10 })))).toMatchObject({
      code: ErrorCodes.WEBHOOK_LIMIT_REACHED,
      limit: 10,
    });
  });

  it('refuses a URL the policy forbids', () => {
    expect(expectErr(decideWebhookCreate(input({ url: 'https://127.0.0.1/in' })))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'url',
      reason: 'private-host',
    });
  });

  it('accepts a local receiver where the policy allows private hosts', () => {
    const created = expectOk(
      decideWebhookCreate(
        input({ url: 'http://localhost:9999/hook', policy: { allowPrivateHosts: true } })
      )
    );

    expect(created.url).toBe('http://localhost:9999/hook');
  });
});
