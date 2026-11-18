import type { Result } from '@kit/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { VideoCorrectionService } from '../video-correction-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000d1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000d2', role: 'USER' };
const VIDEO_ID = '00000000-0000-7000-8000-0000000000da';
const PRIVATE_ID = '00000000-0000-7000-8000-0000000000db';
const NOW = Date.parse('2026-03-10T00:00:00.000Z');
const body = (n: number) => ({ startMs: n * 10_000, endMs: n * 10_000 + 5_000, text: `Fix ${n}` });

describe('apps/server/api/services: corrections', () => {
  let repositories: InMemoryRepositories;
  let corrections: VideoCorrectionService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    corrections = new VideoCorrectionService({
      videos: repositories.videos,
      corrections: repositories.videoCorrections,
      now: () => NOW,
    });
    for (const [id, visibility] of [
      [VIDEO_ID, 'public'],
      [PRIVATE_ID, 'private'],
    ] as const) {
      expectOk(
        await repositories.videos.create({
          id,
          ownerId: OWNER.id,
          title: 'Video',
          visibility,
          status: 'READY',
          sourceKey: `raw/${id}.mp4`,
          durationMs: 300_000,
        })
      );
    }
  });

  it('adds a correction and lists it, in playback order, to anyone who can watch', async () => {
    expectOk(await corrections.create(OWNER, VIDEO_ID, body(3)));
    const created = expectOk(await corrections.create(OWNER, VIDEO_ID, body(1)));

    const { items } = expectOk(await corrections.list(null, VIDEO_ID));

    expect(created).toMatchObject({
      ...body(1),
      videoId: VIDEO_ID,
      createdAt: new Date(NOW).toISOString(),
    });
    expect(items.map((item) => item.text)).toEqual(['Fix 1', 'Fix 3']);
  });

  it('keeps the list of a video the viewer cannot watch as absent as the video', async () => {
    expect(expectErr(await corrections.list(STRANGER, PRIVATE_ID)).code).toBe(
      ErrorCodes.VIDEO_NOT_FOUND
    );
  });

  it('refuses the eleventh correction', async () => {
    for (let n = 0; n < 10; n++) expectOk(await corrections.create(OWNER, VIDEO_ID, body(n)));

    expect(expectErr(await corrections.create(OWNER, VIDEO_ID, body(11))).code).toBe(
      ErrorCodes.CORRECTION_LIMIT
    );
  });

  it.each([
    { name: 'a card that is too short', patch: { endMs: 11_000 } },
    { name: 'text that is blank', patch: { text: '  ' } },
  ])('refuses $name', async ({ patch }) => {
    expect(
      expectErr(await corrections.create(OWNER, VIDEO_ID, { ...body(1), ...patch })).code
    ).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('changes the text and the range of a correction and keeps the rest', async () => {
    const { id } = expectOk(await corrections.create(OWNER, VIDEO_ID, body(1)));

    const changed = expectOk(
      await corrections.update(OWNER, VIDEO_ID, id, { text: ' Fixed ', endMs: 20_000 })
    );

    expect(changed).toMatchObject({ id, startMs: body(1).startMs, endMs: 20_000, text: 'Fixed' });
    expect(expectOk(await corrections.list(null, VIDEO_ID)).items).toMatchObject([changed]);
  });

  it('refuses a change that leaves the range invalid, and an unknown correction', async () => {
    const { id } = expectOk(await corrections.create(OWNER, VIDEO_ID, body(1)));

    expect(expectErr(await corrections.update(OWNER, VIDEO_ID, id, { endMs: 11_000 })).code).toBe(
      ErrorCodes.VALIDATION_FAILED
    );
    expect(expectErr(await corrections.update(OWNER, VIDEO_ID, VIDEO_ID, { text: 'x' })).code).toBe(
      ErrorCodes.CORRECTION_NOT_FOUND
    );
  });

  it('removes a correction, then reports it gone', async () => {
    const { id } = expectOk(await corrections.create(OWNER, VIDEO_ID, body(1)));

    expect(expectOk(await corrections.remove(OWNER, VIDEO_ID, id))).toBeNull();
    expect(expectErr(await corrections.remove(OWNER, VIDEO_ID, id)).code).toBe(
      ErrorCodes.CORRECTION_NOT_FOUND
    );
  });

  it.each(['create', 'update', 'remove'] as const)('refuses a stranger on %s', async (action) => {
    const attempt: Record<typeof action, () => Promise<Result<unknown, { code: string }>>> = {
      create: async () => corrections.create(STRANGER, VIDEO_ID, body(1)),
      update: async () => corrections.update(STRANGER, VIDEO_ID, VIDEO_ID, { text: 'x' }),
      remove: async () => corrections.remove(STRANGER, VIDEO_ID, VIDEO_ID),
    };

    expect(expectErr(await attempt[action]()).code).toBe(ErrorCodes.FORBIDDEN);
  });
});
