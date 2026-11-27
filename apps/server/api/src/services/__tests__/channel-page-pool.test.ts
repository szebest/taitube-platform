import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { seedVideo } from '../../__tests__/test-app';
import { planPage } from '../channel-page/channel-page-plan';
import { loadPagePool } from '../channel-page/channel-page-pool';
import { homeWith, section } from './channel-page-fixtures';
import { TEST_CDN } from './service-deps';

const OWNER = '00000000-0000-7000-8000-0000000000a1';
const VIDEO = '00000000-0000-7000-8000-000000000101';

describe('loadPagePool', () => {
  it('answers the items of each section with a CDN thumbnail, and which fixed tabs have content', async () => {
    const repositories = new InMemoryRepositories();
    const channel = expectOk(
      await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' })
    );
    await seedVideo(repositories, {
      id: VIDEO,
      ownerId: OWNER,
      channelId: channel.id,
      title: 'Clip',
      posterKey: 'posters/clip.jpg',
    });
    const plan = planPage({
      layout: homeWith(section('latest')),
      audience: 'guest',
      locales: ['en'],
      now: new Date(),
    });

    const pool = expectOk(
      await loadPagePool(
        repositories.channelPageSources,
        TEST_CDN,
        channel.id,
        OWNER,
        plan,
        new Date()
      )
    );

    expect(pool.sections['latest']).toMatchObject([
      { kind: 'video', id: VIDEO, thumbnailUrl: `${TEST_CDN}/posters/clip.jpg` },
    ]);
    expect(pool.filled).toEqual({ videos: true, shorts: false, posts: false, playlists: false });
  });
});
