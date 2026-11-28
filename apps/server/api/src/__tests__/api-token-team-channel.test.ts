import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { CHANNEL_HEADER } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing-fixtures';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedTeamMember, seedVideo } from './test-app';

const OWN_VIDEO_ID = '00000000-0000-7000-8000-0000000019b1';
const TEAM_VIDEO_ID = '00000000-0000-7000-8000-0000000019b2';

describe("a team channel's personal access token, end to end", () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("is refused the member's own video on another channel and edits the team's", async () => {
    await seedVideo(repositories, { id: OWN_VIDEO_ID, ownerId: SEEDED.userId });
    const teamChannelId = await seedTeamMember(repositories, {
      ownerId: SEEDED.otherUserId,
      memberId: SEEDED.userId,
      role: 'editor',
    });
    await seedVideo(repositories, {
      id: TEAM_VIDEO_ID,
      ownerId: SEEDED.otherUserId,
      channelId: teamChannelId,
    });
    const created = await app.inject({
      method: 'POST',
      url: '/v1/me/api-tokens',
      headers: { ...bearer(TOKENS.user), [CHANNEL_HEADER]: teamChannelId },
      payload: { name: 'team script', scopes: ['videos:write'] },
    });
    const patch = (id: string) =>
      app.inject({
        method: 'PATCH',
        url: `/v1/creator/videos/${id}`,
        headers: bearer(created.json().token),
        payload: { title: 'After', version: 1 },
      });

    const [own, team] = [await patch(OWN_VIDEO_ID), await patch(TEAM_VIDEO_ID)];

    expect([own.statusCode, own.json().code]).toEqual([403, ErrorCodes.FORBIDDEN]);
    expect([team.statusCode, team.json().title]).toEqual([200, 'After']);
  });
});
