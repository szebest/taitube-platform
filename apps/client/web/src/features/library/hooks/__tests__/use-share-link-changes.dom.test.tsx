import { createPlaylistShareLink, revokePlaylistShareLink } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { NOW, uuid } from '#app/__tests__/library-fixtures';
import { playlistShareLinksQueryOptions } from '#app/features/library/api/playlist-queries';
import { useShareLinkChanges } from '../use-share-link-changes';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);
const LINK = uuid(8801);
const KEY = playlistShareLinksQueryOptions(api, LIST).queryKey;

const CREATED = {
  id: LINK,
  token: 'abcdefghijklmnopqrstuv',
  label: 'Class',
  expiresAt: null,
  revokedAt: null,
  createdAt: NOW,
  state: 'active',
  stats: { opens: 0, views: 0, watchSeconds: 0 },
} as const;

function changeWith(failure: boolean) {
  const sent: string[] = [];
  apiServer.use(
    mockEndpoint(createPlaylistShareLink, async ({ request }) => {
      sent.push(`create ${JSON.stringify(await request.json())}`);
      return failure
        ? problemReply(ErrorCodes.SHARE_LINK_LIMIT)
        : HttpResponse.json(CREATED, { status: 201 });
    }),
    mockEndpoint(revokePlaylistShareLink, ({ params }) => {
      sent.push(`revoke ${String(params.linkId)}`);
      return failure
        ? problemReply(ErrorCodes.INTERNAL)
        : new HttpResponse<null>(null, { status: 204 });
    })
  );
  const client = createQueryClient();
  client.setQueryData(KEY, { items: [] });
  const { result, show } = renderWithToasts(() => useShareLinkChanges(LIST), client);
  return { client, show, sent, changes: result };
}

describe('apps/client/web: useShareLinkChanges', () => {
  it.each([
    {
      change: 'creating a link',
      run: (changes: ReturnType<typeof useShareLinkChanges>) =>
        changes.create.mutateAsync({ label: 'Class', expiresIn: '7d' }),
      sent: 'create {"label":"Class","expiresIn":"7d"}',
      toast: 'Share link created',
    },
    {
      change: 'revoking a link',
      run: (changes: ReturnType<typeof useShareLinkChanges>) => changes.revoke.mutateAsync(LINK),
      sent: `revoke ${LINK}`,
      toast: 'Share link revoked',
    },
  ])('says so and marks the links stale after $change', async ({ run, sent, toast }) => {
    const { client, show, sent: writes, changes } = changeWith(false);

    await run(changes.current);

    expect(writes).toEqual([sent]);
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: toast }));
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
  });

  it.each([
    {
      change: 'creating a link',
      run: (changes: ReturnType<typeof useShareLinkChanges>) =>
        changes.create.mutateAsync({ expiresIn: '7d' }),
    },
    {
      change: 'revoking a link',
      run: (changes: ReturnType<typeof useShareLinkChanges>) => changes.revoke.mutateAsync(LINK),
    },
  ])('shows a refusal as a failure toast after $change', async ({ run }) => {
    const { show, changes } = changeWith(true);

    await run(changes.current).catch(() => undefined);

    expect(show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));
  });
});
