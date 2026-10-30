import { MutationObserver } from '@tanstack/react-query';
import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';

import { videoIdOf } from '#app/features/content/__tests__/creator-video.fixture';
import { serveManagement } from '#app/features/content/__tests__/library-api.fixture';
import { deleteVideosMutationOptions, setVisibilityMutationOptions } from '../batch-actions';
import { libraryKeys } from '../library-queries';

const [first, second, third] = [0, 1, 2].map(videoIdOf) as [string, string, string];
const listed = (...ids: string[]) => ids.map((id) => ({ id, version: 1 }));

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

  it('sets the visibility against the version each video was listed with', async () => {
    const requests = serveManagement();
    const client = createQueryClient();

    await new MutationObserver(client, setVisibilityMutationOptions(api)).mutate({
      videos: [
        { id: first, version: 3 },
        { id: second, version: 7 },
      ],
      visibility: 'unlisted',
    });

    expect(requests).toEqual(
      expect.arrayContaining([
        { method: 'PATCH', id: first, body: { visibility: 'unlisted', version: 3 } },
        { method: 'PATCH', id: second, body: { visibility: 'unlisted', version: 7 } },
      ])
    );
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
        new MutationObserver(client, setVisibilityMutationOptions(api)).mutate({
          videos: listed(first, second, third),
          visibility: 'private',
        }),
    },
  ])('reports which videos $name failed for and keeps the rest', async ({ run }) => {
    serveManagement([second]);

    const outcome = await run(createQueryClient());

    expect(outcome).toEqual({ succeeded: [first, third], failed: [second] });
  });

  it('refetches the library whether or not every video went through', async () => {
    serveManagement([first]);
    const client = createQueryClient();
    client.setQueryData(libraryKeys.view('newest', 1), { items: [], page: 1, hasNextPage: false });

    await new MutationObserver(client, deleteVideosMutationOptions(api)).mutate(listed(first));

    expect(client.getQueryState(libraryKeys.view('newest', 1))?.isInvalidated).toBe(true);
  });
});
