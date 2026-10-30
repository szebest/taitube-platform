import { deleteClip } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { clipKeys, createQueryClient } from '@vp/queries';
import { apiServer, CLIP_ID, clip, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { useDeleteClip } from '../use-delete-clip';

describe('apps/client/web: useDeleteClip', () => {
  it('deletes the clip and marks it and my clips stale, without asking the API for the clip again', async () => {
    const removed: unknown[] = [];
    apiServer.use(
      mockEndpoint(deleteClip, ({ params }) => {
        removed.push(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );
    const client = createQueryClient();
    client.setQueryData(clipKeys.mine(), { pages: [], pageParams: [] });
    client.setQueryData(clipKeys.detail(CLIP_ID), clip());

    await runMutation(client, () => useDeleteClip(CLIP_ID), undefined, AppProviders);

    expect(removed).toEqual([CLIP_ID]);
    expect(client.getQueryState(clipKeys.mine())?.isInvalidated).toBe(true);
    expect(client.getQueryState(clipKeys.detail(CLIP_ID))?.isInvalidated).toBe(true);
  });

  it('rejects when the API refuses', async () => {
    apiServer.use(mockEndpoint(deleteClip, () => problemReply(ErrorCodes.FORBIDDEN)));

    const settled = await runMutation(
      createQueryClient(),
      () => useDeleteClip(CLIP_ID),
      undefined,
      AppProviders
    );

    expect(settled.status).toBe('rejected');
  });
});
