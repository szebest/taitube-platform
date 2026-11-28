import { randomUUID } from 'node:crypto';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedVideo } from '../../__tests__/test-app';
import { PlaylistPortabilityService } from '../playlist-portability-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000d101', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000d102', role: 'USER' };
const PLAYLIST = '00000000-0000-7000-8000-00000000d1a1';
const TIMED = '00000000-0000-7000-8000-00000000d1b1';
const WEB = 'http://web.test';

async function setUp() {
  const repositories = new InMemoryRepositories();
  const service = new PlaylistPortabilityService({
    playlists: repositories.playlists,
    videos: repositories.videos,
    webUrl: WEB,
    newId: randomUUID,
  });
  await seedVideo(repositories, {
    id: TIMED,
    ownerId: OWNER.id,
    title: 'Lecture',
    durationMs: 60_000,
  });
  expectOk(
    await repositories.playlists.create({
      id: PLAYLIST,
      ownerId: OWNER.id,
      title: 'Mix',
      description: '',
      visibility: 'private',
    })
  );
  return { repositories, service };
}

describe('PlaylistPortabilityService', () => {
  it('imports a note and a valid segment, and drops a segment past the video', async () => {
    const { repositories, service } = await setUp();
    const content = JSON.stringify({
      items: [{ url: `${WEB}/watch/${TIMED}`, note: 'Chapter 2', startMs: 5000, endMs: 90_000 }],
    });

    const imported = expectOk(await service.import(OWNER, PLAYLIST, { format: 'json', content }));

    expect(imported.lines).toEqual([{ line: 1, status: 'added', videoId: TIMED }]);
    expect(expectOk(await repositories.playlists.findItems(PLAYLIST))).toMatchObject([
      { note: 'Chapter 2', startMs: null, endMs: null },
    ]);
  });

  it('exports the videos with their watch URL, and keeps a private playlist from a stranger', async () => {
    const { service } = await setUp();
    expectOk(await service.import(OWNER, PLAYLIST, { format: 'urls', content: TIMED }));

    const exported = expectOk(await service.export(OWNER, PLAYLIST, 'csv'));

    expect(exported).toMatchObject({ format: 'csv', filename: `playlist-${PLAYLIST}.csv` });
    expect(exported.content).toContain(`${WEB}/watch/${TIMED}`);
    expect(expectErr(await service.export(STRANGER, PLAYLIST, 'json')).code).toBe(
      ErrorCodes.PLAYLIST_NOT_FOUND
    );
    expect(
      expectErr(await service.import(STRANGER, PLAYLIST, { format: 'urls', content: TIMED })).code
    ).toBe(ErrorCodes.PLAYLIST_NOT_FOUND);
  });
});
