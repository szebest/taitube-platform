import type { WebhookRepositoryPort } from '@vp/core/repositories';
import type { Webhook } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const BASE = Date.parse('2026-03-01T12:00:00.000Z');

const webhookId = (n: number) => `00000000-0000-7000-8000-00000000e1${String(n).padStart(2, '0')}`;

function webhook(n: number, overrides: Partial<Webhook> = {}): Webhook {
  return {
    id: webhookId(n),
    ownerId: OWNER_ID,
    url: `https://hooks.example.com/${n}`,
    events: ['video.ready'],
    secret: `secret-${n}`,
    createdAt: new Date(BASE + n * 60_000),
    ...overrides,
  };
}

export function describeWebhookRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('WebhookRepository contract', () => {
    let subject: RepositoriesSubject;
    let webhooks: WebhookRepositoryPort;

    const save = async (...rows: Webhook[]) => {
      for (const row of rows) expectOk(await webhooks.create(row));
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      webhooks = subject.repositories.webhooks;
    });

    it('lists the webhooks of one owner oldest first, with their secrets', async () => {
      await save(webhook(2), webhook(1), webhook(3, { ownerId: OTHER_OWNER_ID }));

      expect(expectOk(await webhooks.listByOwner(OWNER_ID))).toEqual([webhook(1), webhook(2)]);
    });

    it('lists nothing for an owner with no webhooks', async () => {
      expect(expectOk(await webhooks.listByOwner(OWNER_ID))).toEqual([]);
    });

    it('keeps the events as stored', async () => {
      const both = webhook(1, { events: ['live.started', 'video.ready'] });
      await save(both);

      expect(expectOk(await webhooks.listByOwner(OWNER_ID))).toEqual([both]);
    });

    it('lists only the webhooks subscribed to an event', async () => {
      await save(
        webhook(1, { events: ['video.ready'] }),
        webhook(2, { events: ['live.started'] }),
        webhook(3, { events: ['live.started', 'video.ready'] }),
        webhook(4, { ownerId: OTHER_OWNER_ID, events: ['video.ready'] })
      );

      const ready = expectOk(await webhooks.listSubscribed(OWNER_ID, 'video.ready'));
      const live = expectOk(await webhooks.listSubscribed(OWNER_ID, 'live.started'));

      expect(ready.map((row) => row.id)).toEqual([webhookId(1), webhookId(3)]);
      expect(live.map((row) => row.id)).toEqual([webhookId(2), webhookId(3)]);
    });

    it('removes a webhook of the owner', async () => {
      await save(webhook(1), webhook(2));

      expect(expectOk(await webhooks.remove(OWNER_ID, webhookId(1)))).toBe(true);
      expect(expectOk(await webhooks.listByOwner(OWNER_ID)).map((row) => row.id)).toEqual([
        webhookId(2),
      ]);
    });

    it('removes nothing that belongs to another owner, or that is not there', async () => {
      await save(webhook(1));

      expect(expectOk(await webhooks.remove(OTHER_OWNER_ID, webhookId(1)))).toBe(false);
      expect(expectOk(await webhooks.remove(OWNER_ID, webhookId(9)))).toBe(false);
      expect(expectOk(await webhooks.listByOwner(OWNER_ID))).toHaveLength(1);
    });
  });
}
