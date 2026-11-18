import { MutationObserver } from '@tanstack/react-query';
import type { BulkEditPatch } from '@vp/domain';
import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';
import { videoIdOf } from '#app/__tests__/creator-video.fixture';
import { serveManagement } from '#app/__tests__/library-api.fixture';
import { deleteVideosMutationOptions, editVideosMutationOptions } from '../batch-actions';
import { libraryKeys } from '../library-queries';

const [first, second, third] = [0, 1, 2].map(videoIdOf) as [string, string, string];
const listed = (...ids: string[]) => ids.map((id) => ({ id, title: `Video ${id}` }));

const PATCHES: { name: string; patch: BulkEditPatch }[] = [
  { name: 'visibility', patch: { visibility: 'unlisted' } },
  { name: 'category', patch: { categoryId: null } },
  { name: 'added tags', patch: { addTags: ['travel'] } },
  { name: 'removed tags', patch: { removeTags: ['old'] } },
  { name: 'comments', patch: { commentsEnabled: false } },
];

describe('apps/client/studio: batch actions', () => {
  it('deletes every video it is given, one request each', async () => {
    const requests = serveManagement();
    const client = createQueryClient();

    const outcome = await new MutationObserver(client, deleteVideosMutationOptions(api)).mutate(
      listed(first, second)
    );

    expect(outcome).toEqual({ succeeded: [first, second], failed: [] });
    expect(requests.map(({ method, id }) => `${method} ${id}`).sort()).toEqual([
      `DELETE ${first}`,
      `DELETE ${second}`,
    ]);
  });

  it.each(PATCHES)('changes the $name with one bulk request for every video', async ({ patch }) => {
    const requests = serveManagement();
    const client = createQueryClient();

    const outcome = await new MutationObserver(client, editVideosMutationOptions(api)).mutate({
      videos: listed(first, second),
      patch,
    });

    expect(outcome).toEqual({ succeeded: [first, second], failed: [] });
    expect(requests).toEqual([
      { method: 'POST', id: 'bulk', body: { ids: [first, second], patch } },
    ]);
  });

  it.each([
    {
      name: 'a delete',
      run: (client: ReturnType<typeof createQueryClient>) =>
        new MutationObserver(client, deleteVideosMutationOptions(api)).mutate(
          listed(first, second, third)
        ),
    },
    {
      name: 'a visibility change',
      run: (client: ReturnType<typeof createQueryClient>) =>
        new MutationObserver(client, editVideosMutationOptions(api)).mutate({
          videos: listed(first, second, third),
          patch: { visibility: 'private' },
        }),
    },
  ])('reports which videos $name failed for, with why, and keeps the rest', async ({ run }) => {
    serveManagement([second]);

    const outcome = await run(createQueryClient());

    expect(outcome.succeeded).toEqual([first, third]);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0]?.id).toBe(second);
    expect(outcome.failed[0]?.code).toEqual(expect.any(String));
  });

  it('names the code the bulk edit refused a video with', async () => {
    serveManagement([second]);

    const outcome = await new MutationObserver(
      createQueryClient(),
      editVideosMutationOptions(api)
    ).mutate({ videos: listed(first, second), patch: { commentsEnabled: true } });

    expect(outcome.failed).toEqual([{ id: second, code: 'VIDEO_NOT_FOUND' }]);
  });

  it('refetches the library whether or not every video went through', async () => {
    serveManagement([first]);
    const client = createQueryClient();
    client.setQueryData(libraryKeys.view({ sort: 'newest', page: 1 }), {
      items: [],
      page: 1,
      hasNextPage: false,
    });

    await new MutationObserver(client, deleteVideosMutationOptions(api)).mutate(listed(first));

    expect(client.getQueryState(libraryKeys.view({ sort: 'newest', page: 1 }))?.isInvalidated).toBe(
      true
    );
  });
});
