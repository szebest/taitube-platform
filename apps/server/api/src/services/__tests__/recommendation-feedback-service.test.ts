import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import type { Mock } from 'vitest';
import { RecommendationFeedbackService } from '../recommendation-feedback-service';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

const VIEWER: UserContext = { id: '00000000-0000-7000-8000-00000000f001', role: 'USER' };
const GUEST_ROLE: UserContext = { id: '00000000-0000-7000-8000-00000000f002', role: 'GUEST' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000f004', role: 'USER' };
const OWNER = '00000000-0000-7000-8000-00000000f003';
const VIDEO = '00000000-0000-7000-8000-00000000f0a1';
const PRIVATE = '00000000-0000-7000-8000-00000000f0a2';
const CHANNEL = '00000000-0000-7000-8000-00000000f0b1';
const NOW = Date.parse('2026-03-01T12:00:00.000Z');

describe('apps/server/api/services: RecommendationFeedbackService', () => {
  let repositories: InMemoryRepositories;
  let forget: Mock<(userId: string) => Promise<void>>;
  let service: RecommendationFeedbackService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    forget = vi.fn<(userId: string) => Promise<void>>(async () => {});
    service = new RecommendationFeedbackService({
      feedback: repositories.recommendationFeedback,
      videos: repositories.videos,
      channels: repositories.channels,
      home: { forget },
      paginator: new Paginator({ defaultLimit: 20, maxLimit: 100 }),
      cdn: TEST_CDN,
      sprite: TEST_SPRITE,
      now: () => NOW,
    });
    await repositories.channels.create({
      id: CHANNEL,
      userId: OWNER,
      handle: 'owner',
      displayName: 'Owner',
    });
    for (const [id, visibility] of [
      [VIDEO, 'public'],
      [PRIVATE, 'private'],
    ] as const) {
      await repositories.videos.create({
        id,
        ownerId: OWNER,
        title: id,
        visibility,
        status: 'READY',
        sourceKey: `raw/${id}.mp4`,
      });
    }
  });

  it('stamps the row with the clock and drops the cached home page of the caller', async () => {
    const put = expectOk(await service.put(VIEWER, { kind: 'not_interested', videoId: VIDEO }));

    expect(put).toMatchObject({
      kind: 'not_interested',
      videoId: VIDEO,
      createdAt: new Date(NOW).toISOString(),
    });
    expect(forget).toHaveBeenCalledWith(VIEWER.id);
  });

  it.each([
    { scenario: 'a private video', body: { kind: 'not_interested', videoId: PRIVATE } },
    { scenario: 'an unknown channel', body: { kind: 'hide_channel', channelId: PRIVATE } },
  ] as const)('writes nothing for $scenario', async ({ body }) => {
    expectErr(await service.put(VIEWER, body));

    expect(forget).not.toHaveBeenCalled();
    expect(expectOk(await service.list(VIEWER, {})).items).toEqual([]);
  });

  it.each<{ action: string; call: () => Promise<Result<unknown, { code: string }>> }>([
    {
      action: 'put',
      call: () => service.put(GUEST_ROLE, { kind: 'hide_channel', channelId: CHANNEL }),
    },
    { action: 'list', call: () => service.list(GUEST_ROLE, {}) },
    { action: 'remove', call: () => service.remove(GUEST_ROLE, VIDEO) },
  ])('refuses a guest role on $action with FORBIDDEN', async ({ call }) => {
    expect(expectErr(await call()).code).toBe(ErrorCodes.FORBIDDEN);
    expect(forget).not.toHaveBeenCalled();
  });

  it('removes a row of the caller and drops the page, but not for a row that is not theirs', async () => {
    const { id } = expectOk(
      await service.put(VIEWER, { kind: 'hide_channel', channelId: CHANNEL })
    );
    forget.mockClear();

    expect(expectErr(await service.remove(STRANGER, id)).code).toBe(
      ErrorCodes.RECOMMENDATION_FEEDBACK_NOT_FOUND
    );
    expect(forget).not.toHaveBeenCalled();

    expectOk(await service.remove(VIEWER, id));
    expect(forget).toHaveBeenCalledWith(VIEWER.id);
    expect(expectErr(await service.remove(VIEWER, id)).code).toBe(
      ErrorCodes.RECOMMENDATION_FEEDBACK_NOT_FOUND
    );
  });

  it('refuses a cursor that is not one', async () => {
    expect(expectErr(await service.list(VIEWER, { cursor: 'nope' })).code).toBe(
      ErrorCodes.INVALID_CURSOR
    );
  });
});
