import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { type SearchResult, SearchService } from '../search-service';
import { sessionShown, startTitleTest } from './running-test';
import { searchServiceDeps } from './service-deps';

const OWNER = '00000000-0000-7000-8000-0000000007a1';
const VIDEO = '00000000-0000-7000-8000-0000000007a2';
const request = {
  q: 'ownership',
  type: 'all',
  sort: 'relevance',
  limit: 20,
  record: false,
} as const;
const videoOf = (page: SearchResult) => page.data.items[0]?.data;

describe('apps/server/api/services: SearchService test variants', () => {
  it('shows a session its variant over the cached page, and the next caller the control', async () => {
    const repositories = new InMemoryRepositories();
    const service = new SearchService(searchServiceDeps(repositories));
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER,
        title: 'Rust ownership explained',
        visibility: 'public',
        status: 'READY',
        sourceKey: `raw/${VIDEO}.mp4`,
      })
    );
    const test = await startTitleTest(repositories, {
      videoId: VIDEO,
      ownerId: OWNER,
      control: 'Rust ownership explained',
      challenger: 'Ownership in ten minutes',
    });

    const shown = expectOk(await service.search(request, null, sessionShown(test.id, 'b')));
    const control = expectOk(await service.search(request));

    expect(videoOf(shown)).toMatchObject({
      title: 'Ownership in ten minutes',
      experiment: { id: test.id, variantId: 'b' },
    });
    expect(control.cache).toBe('HIT');
    expect(videoOf(control)).toMatchObject({ title: 'Rust ownership explained' });
    expect(videoOf(control)).not.toHaveProperty('experiment');
  });
});
