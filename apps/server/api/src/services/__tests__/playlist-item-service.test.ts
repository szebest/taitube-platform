import { randomUUID } from 'node:crypto';
import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { asCdnBase } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedVideo } from '../../__tests__/test-app';
import { PlaylistItemService } from '../playlist-item-service';
import { TEST_SPRITE } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000b101', role: 'USER' };
const PLAYLIST = '00000000-0000-7000-8000-00000000b1a1';
const SHORT = '00000000-0000-7000-8000-00000000b1b1';
const LONG = '00000000-0000-7000-8000-00000000b1b2';
const SECTION = '00000000-0000-7000-8000-00000000b1c9';

async function setUp() {
  const repositories = new InMemoryRepositories();
  const service = new PlaylistItemService({
    playlists: repositories.playlists,
    videos: repositories.videos,
    paginator: new Paginator(),
    cdn: asCdnBase('http://cdn.test'),
    sprite: TEST_SPRITE,
    newId: () => SECTION,
  });
  expectOk(
    await repositories.playlists.create({
      id: PLAYLIST,
      ownerId: OWNER.id,
      title: 'Mix',
      description: '',
      visibility: 'public',
    })
  );
  for (const [id, durationMs] of [
    [LONG, 90_000],
    [SHORT, 10_000],
  ] as const) {
    await seedVideo(repositories, { id, ownerId: OWNER.id, title: id, durationMs });
    expectOk(
      await repositories.playlists.addItem(
        PLAYLIST,
        { id: randomUUID(), videoId: id, addedBy: OWNER.id },
        OWNER.id
      )
    );
  }
  const items = expectOk(await repositories.playlists.findItems(PLAYLIST));
  return { repositories, service, items };
}

describe('PlaylistItemService', () => {
  it('pages by duration for an anonymous reader and refuses a cursor of another sort', async () => {
    const { service } = await setUp();

    const page = expectOk(await service.list(null, PLAYLIST, { sort: 'duration', limit: 1 }));
    const rest = expectOk(
      await service.list(null, PLAYLIST, { sort: 'duration', cursor: page.nextCursor ?? undefined })
    );

    expect([...page.items, ...rest.items].map((item) => item.videoId)).toEqual([SHORT, LONG]);
    expect(
      expectErr(
        await service.list(null, PLAYLIST, { sort: 'added', cursor: page.nextCursor ?? undefined })
      ).code
    ).toBe(ErrorCodes.INVALID_CURSOR);
  });

  it.each([
    { scenario: 'a segment inside the video', patch: { startMs: 1000, endMs: 5000 }, code: null },
    {
      scenario: 'an end past the video',
      patch: { endMs: 20_000 },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    { scenario: 'a title on a video', patch: { title: 'x' }, code: ErrorCodes.VALIDATION_FAILED },
  ])('edits $scenario on a 10 second video: $code', async ({ patch, code }) => {
    const { service, items } = await setUp();
    const short = items.find((item) => item.videoId === SHORT);

    const edited = await service.edit(OWNER, PLAYLIST, short?.id ?? '', patch);

    expect(edited.ok ? null : edited.error.code).toBe(code);
  });

  it('adds and removes a section, and writes a sort back', async () => {
    const { repositories, service, items } = await setUp();

    expect(expectOk(await service.addSection(OWNER, PLAYLIST, 'Part two'))).toEqual({
      id: SECTION,
    });
    expectOk(await service.sort(OWNER, PLAYLIST, 'duration'));
    expect(expectErr(await service.removeSection(OWNER, PLAYLIST, items[0]?.id ?? '')).code).toBe(
      ErrorCodes.PLAYLIST_ITEM_NOT_FOUND
    );
    expectOk(await service.removeSection(OWNER, PLAYLIST, SECTION));

    const order = expectOk(await repositories.playlists.findItems(PLAYLIST)).map(
      (item) => item.videoId
    );
    expect(order).toEqual([SHORT, LONG]);
  });
});
