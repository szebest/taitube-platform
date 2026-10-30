import { createClip } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { clipKeys, createQueryClient } from '@vp/queries';
import { apiServer, clip, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { useCreateClip } from '../use-create-clip';

const NEW_CLIP = { startMs: 20_000, endMs: 40_000, title: 'The best part' };

describe('apps/client/web: useCreateClip', () => {
  it('posts the clip to its video and marks my clips stale', async () => {
    const posted: unknown[] = [];
    apiServer.use(
      mockEndpoint(createClip, async ({ params, request }) => {
        posted.push([params.id, await request.json()]);
        return HttpResponse.json(clip(NEW_CLIP), { status: 201 });
      })
    );
    const client = createQueryClient();
    client.setQueryData(clipKeys.mine(), { pages: [], pageParams: [] });

    await runMutation(client, () => useCreateClip(VIDEO_ID), NEW_CLIP, AppProviders);

    expect(posted).toEqual([[VIDEO_ID, NEW_CLIP]]);
    expect(client.getQueryState(clipKeys.mine())?.isInvalidated).toBe(true);
  });

  it('rejects when the API refuses the clip', async () => {
    apiServer.use(mockEndpoint(createClip, () => problemReply(ErrorCodes.VALIDATION_FAILED)));

    const settled = await runMutation(
      createQueryClient(),
      () => useCreateClip(VIDEO_ID),
      NEW_CLIP,
      AppProviders
    );

    expect(settled.status).toBe('rejected');
  });
});
