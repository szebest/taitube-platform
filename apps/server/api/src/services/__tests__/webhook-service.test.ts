import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { WebhookService } from '../webhook-service';

const VIEWER: UserContext = { id: '00000000-0000-7000-8000-00000000c001', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000c002', role: 'USER' };
const NOW = Date.parse('2026-03-01T12:00:00.000Z');
const BODY = { url: 'https://hooks.example.com/in', events: ['video.ready' as const] };

describe('apps/server/api/services: WebhookService', () => {
  let repositories: InMemoryRepositories;
  let service: WebhookService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    service = new WebhookService({
      webhooks: repositories.webhooks,
      policy: { allowPrivateHosts: false },
      newSecret: () => 'secret-1',
      now: () => NOW,
    });
  });

  it('stores a webhook and hands its secret back once', async () => {
    const created = expectOk(await service.create(VIEWER, BODY));

    expect(created).toMatchObject({
      ...BODY,
      secret: 'secret-1',
      createdAt: '2026-03-01T12:00:00.000Z',
    });
    const listed = expectOk(await service.list(VIEWER));
    expect(listed.items).toEqual([{ id: created.id, ...BODY, createdAt: created.createdAt }]);
  });

  it('refuses a private host and the eleventh webhook', async () => {
    expect(
      expectErr(await service.create(VIEWER, { ...BODY, url: 'https://10.0.0.1/in' }))
    ).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });

    for (let index = 0; index < 10; index += 1) expectOk(await service.create(VIEWER, BODY));
    expect(expectErr(await service.create(VIEWER, BODY))).toMatchObject({
      code: ErrorCodes.WEBHOOK_LIMIT_REACHED,
    });
  });

  it('keeps a webhook to its owner', async () => {
    const { id } = expectOk(await service.create(VIEWER, BODY));

    expect(expectErr(await service.remove(STRANGER, id))).toMatchObject({
      code: ErrorCodes.WEBHOOK_NOT_FOUND,
    });
    expectOk(await service.remove(VIEWER, id));
    expect(expectOk(await service.list(VIEWER)).items).toEqual([]);
  });
});
