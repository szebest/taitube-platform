import { randomUUID } from 'node:crypto';
import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedVideo } from '../../__tests__/test-app';
import { PlaylistLibraryService } from '../playlist-library-service';
import { playlistReading } from './playlist-reading';
import { TEST_CDN } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000b1', role: 'USER' };
const FAN: UserContext = { id: '00000000-0000-7000-8000-0000000000b2', role: 'USER' };
const LIST = '00000000-0000-7000-8000-0000000000b3';
const VIDEOS = ['00000000-0000-7000-8000-0000000000ba', '00000000-0000-7000-8000-0000000000bb'];

async function setUp(rules: { limit: number } | null = null) {
  const repositories = new InMemoryRepositories();
  for (const id of VIDEOS) await seedVideo(repositories, { id, ownerId: OWNER.id, title: id });
  expectOk(
    await repositories.playlists.create({
      id: LIST,
      ownerId: OWNER.id,
      title: 'Mix',
      description: 'Why',
      visibility: 'public',
      rules: rules && { match: 'all', conditions: [], sort: 'oldest', ...rules },
    })
  );
  const { reader, smart, recorder, viewBuffer } = playlistReading(repositories);
  const library = new PlaylistLibraryService({
    playlists: repositories.playlists,
    library: repositories.playlistLibrary,
    views: reader,
    smart,
    recorder,
    paginator: new Paginator(),
    cdn: TEST_CDN,
    newId: randomUUID,
    now: Date.now,
  });
  const counted = async () => expectOk(await viewBuffer.snapshot(randomUUID()))?.playlists ?? [];
  return { library, counted };
}

describe('PlaylistLibraryService', () => {
  it('counts a follow once however often it is asked for', async () => {
    const { library, counted } = await setUp();

    expectOk(await library.follow(FAN, LIST));
    expectOk(await library.follow(FAN, LIST));

    expect(await counted()).toEqual([expect.objectContaining({ follows: 1, forks: 0 })]);
  });

  it('counts a fork against its source', async () => {
    const { library, counted } = await setUp();

    const fork = expectOk(await library.fork(FAN, LIST));

    expect(fork).toMatchObject({ ownerId: FAN.id, forkedFromPlaylistId: LIST, description: 'Why' });
    expect(await counted()).toEqual([expect.objectContaining({ playlistId: LIST, forks: 1 })]);
  });

  it('freezes no more than the rules hold', async () => {
    const { library } = await setUp({ limit: 1 });

    const frozen = expectOk(await library.freeze(FAN, LIST));

    expect(frozen.items.map((item) => item.videoId)).toEqual([VIDEOS[0]]);
  });

  it('drops a follow whether or not the list can still be read', async () => {
    const { library } = await setUp();

    expectOk(await library.unfollow(FAN, '00000000-0000-7000-8000-0000000000bf'));
  });

  it('unpins only what the owner pinned, and answers a stranger 403', async () => {
    const { library } = await setUp();

    expectOk(await library.pin(OWNER, LIST));
    expectOk(await library.unpin(OWNER, LIST));

    expect(expectErr(await library.unpin(FAN, LIST)).code).toBe(ErrorCodes.FORBIDDEN);
  });
});
