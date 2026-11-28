import * as os from 'node:os';
import { createLogger } from '@kit/logger';
import { expectOk } from '@kit/testing/result';
import {
  InMemoryRepositories,
  InMemoryStorageClient,
  InMemoryWebhookDispatcher,
} from '@vp/adapters/in-memory';
import type { ChannelRole } from '@vp/domain';
import { uuidv7 } from 'uuidv7';
import { createExportProcessor } from '../export-stage';

const OWNER_ID = uuidv7();
const MANAGER_ID = uuidv7();
const PEER_ID = uuidv7();
const MODERATOR_ID = uuidv7();
const NOW = Date.parse('2026-03-01T12:00:00.000Z');
const logger = createLogger({ format: 'json', service: 'export-audience-spec', level: 'silent' });

const HOOKS = { owner: OWNER_ID, requester: MANAGER_ID, peer: PEER_ID, moderator: MODERATOR_ID };
const urlOf = (name: string) => `https://hooks.example.com/${name}`;

describe('worker/exports: who hears export.ready', () => {
  let repositories: InMemoryRepositories;
  let dispatcher: InMemoryWebhookDispatcher;
  let channelId: string;

  async function join(userId: string, role: ChannelRole) {
    const inviteId = uuidv7();
    const audit = (action: 'invite.created' | 'invite.accepted', actorUserId: string) => ({
      channelId,
      actorUserId,
      action,
      targetType: 'invite' as const,
      targetId: inviteId,
      meta: { inviteeUserId: userId, role },
    });
    expectOk(
      await repositories.channelInvites.create(
        {
          id: inviteId,
          channelId,
          inviteeUserId: userId,
          role,
          invitedBy: OWNER_ID,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        audit('invite.created', OWNER_ID)
      )
    );
    expectOk(
      await repositories.channelInvites.accept(inviteId, userId, audit('invite.accepted', userId))
    );
  }

  async function exportRequestedBy(requestedBy: string) {
    const id = uuidv7();
    expectOk(
      await repositories.dataExports.create(
        { id, channelId, requestedBy, kind: 'comments', params: {}, format: 'csv' },
        {
          channelId,
          actorUserId: requestedBy,
          action: 'export.requested',
          targetType: 'export',
          targetId: id,
          meta: { kind: 'comments', format: 'csv' },
        }
      )
    );
    const process = createExportProcessor({
      repositories,
      storage: new InMemoryStorageClient(),
      webhookDispatcher: dispatcher,
      bucket: 'raw',
      tmpDir: os.tmpdir(),
      logger,
      now: () => NOW,
    });
    expectOk(
      await process({ id: `${id}--export`, name: 'export', data: { exportId: id }, opts: {} })
    );
    return dispatcher.deliveries.map(({ webhook }) => webhook.url).sort();
  }

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    dispatcher = new InMemoryWebhookDispatcher();
    channelId = expectOk(
      await repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    ).id;
    await join(MANAGER_ID, 'manager');
    await join(PEER_ID, 'manager');
    await join(MODERATOR_ID, 'moderator');
    for (const [name, ownerId] of Object.entries(HOOKS)) {
      expectOk(
        await repositories.webhooks.create({
          id: uuidv7(),
          ownerId,
          url: urlOf(name),
          events: ['export.ready'],
          secret: 'secret',
          createdAt: new Date(NOW),
        })
      );
    }
  });

  it.each([
    { who: 'the owner', name: 'owner', heard: true },
    { who: 'the member who asked, who holds the ability', name: 'requester', heard: true },
    { who: 'another member who holds the ability', name: 'peer', heard: true },
    { who: 'a member without the ability', name: 'moderator', heard: false },
  ])('delivers to $who: $heard', async ({ name, heard }) => {
    const delivered = await exportRequestedBy(MANAGER_ID);

    expect(delivered.includes(urlOf(name))).toBe(heard);
  });

  it('delivers once to each webhook when the owner asked', async () => {
    expect(await exportRequestedBy(OWNER_ID)).toEqual(['owner', 'peer', 'requester'].map(urlOf));
  });
});
