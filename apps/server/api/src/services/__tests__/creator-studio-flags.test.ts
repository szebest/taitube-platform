import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import type { CreatorStudioService } from '../creator-studio-service';
import { creatorStudioOf } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000e1', role: 'CREATOR' };
const VIDEO_ID = '00000000-0000-7000-8000-0000000000ea';
const CATEGORY_ID = '00000000-0000-7000-8000-0000000000ec';

describe('apps/server/api/services: creator studio edit flags', () => {
  let repositories: InMemoryRepositories;
  let studio: CreatorStudioService;

  const seed = async () =>
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        title: 'Studio fixture',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/studio.mp4',
      })
    );

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    studio = creatorStudioOf(repositories);
    expectOk(
      await repositories.categories.create({ id: CATEGORY_ID, slug: 'music', name: 'Music' })
    );
  });

  it.each([
    { name: 'a profane new title', patch: { title: 'This is shit' }, flagged: true },
    { name: 'a clean new title', patch: { title: 'A calm walk' }, flagged: false },
    { name: 'a category change only', patch: { categoryId: CATEGORY_ID }, flagged: false },
  ])(
    'raises a flag for $name: $flagged, and leaves the state alone',
    async ({ patch, flagged }) => {
      const { version } = await seed();

      const view = expectOk(await studio.update(OWNER, VIDEO_ID, { ...patch, version }));

      const latest = expectOk(await repositories.screenings.latestForVideo(VIDEO_ID));
      expect(latest?.flags.map(({ reason }) => reason) ?? []).toEqual(
        flagged ? ['METADATA_SPAM'] : []
      );
      expect(view.status).toBe('READY');
    }
  );
});
