import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { CHANNEL_HEADER, contracts, isEndpoint } from '@vp/api-contracts';
import { mintToken } from '@vp/dev-token';
import { NOTIFY_TEAM_INVITE } from '@vp/job-contracts';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedVideo } from './test-app';

const EDITOR_ID = '00000000-0000-7000-8000-0000000017f1';
const EDITOR_TOKEN = mintToken({ sub: EDITOR_ID, role: 'user', ttl: '1h' });
const VIDEO_ID = '00000000-0000-7000-8000-0000000017f2';

describe('channel team flow: invite, accept, edit as an editor, read the audit log', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('records the editor, not the owner, against the edit', async () => {
    expectOk(
      await repositories.channels.create({ userId: EDITOR_ID, handle: 'ed', displayName: 'Ed' })
    );
    await seedVideo(repositories, { id: VIDEO_ID, ownerId: SEEDED.userId, title: 'Draft' });

    const invited = await app.inject({
      method: 'POST',
      url: '/v1/me/channel/invites',
      headers: bearer(TOKENS.user),
      payload: { handle: 'ed', role: 'editor' },
    });
    expect(invited.statusCode).toBe(201);
    const inviteId: string = invited.json().id;

    const relayed = expectOk(await repositories.outbox.claimBatch(10)).flatMap((row) =>
      row.payload.type === 'queue' ? [row.payload.job] : []
    );
    expect(relayed).toEqual([
      expect.objectContaining({ name: NOTIFY_TEAM_INVITE, data: { inviteId } }),
    ]);

    const accepted = await app.inject({
      method: 'POST',
      url: `/v1/invites/${inviteId}/accept`,
      headers: bearer(EDITOR_TOKEN),
    });
    expect(accepted.statusCode).toBe(200);
    const { channelId } = accepted.json();

    const memberships = await app.inject({
      method: 'GET',
      url: '/v1/me/memberships',
      headers: bearer(EDITOR_TOKEN),
    });
    expect(memberships.json().items).toEqual([
      expect.objectContaining({ channelId, role: 'editor' }),
    ]);

    const version = expectOk(await repositories.videos.findById(VIDEO_ID))?.version;
    const edited = await app.inject({
      method: 'PATCH',
      url: `/v1/creator/videos/${VIDEO_ID}`,
      headers: { ...bearer(EDITOR_TOKEN), [CHANNEL_HEADER]: channelId },
      payload: { title: 'Edited by the team', version },
    });
    expect(edited.statusCode).toBe(200);

    const audit = await app.inject({
      method: 'GET',
      url: '/v1/me/channel/audit?action=video.updated',
      headers: bearer(TOKENS.user),
    });
    expect(audit.json().items).toEqual([
      expect.objectContaining({
        action: 'video.updated',
        targetId: VIDEO_ID,
        actorUserId: EDITOR_ID,
        actor: { handle: 'ed', displayName: 'Ed', avatarUrl: null },
        meta: { fields: ['title'] },
      }),
    ]);
  });

  it('serves no route that changes or deletes an audit row', () => {
    const writes = Object.values(contracts)
      .flatMap((group) => Object.values(group).filter(isEndpoint))
      .filter(({ method, path }) => path.includes('/audit') && method !== 'GET');

    expect(writes).toEqual([]);
    expect(
      app
        .printRoutes({ commonPrefix: false })
        .split('\n')
        .filter((line) => line.includes('audit'))
    ).toEqual([expect.stringMatching(/audit \(GET, HEAD\)$/)]);
  });
});
