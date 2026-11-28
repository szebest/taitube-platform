import { getPlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { loadPlaylist } from '../load-playlist';

const LIST = uuid(4100);
const TOKEN = 'a'.repeat(32);

function serve(reply: () => Response) {
  const tokens: (string | null)[] = [];
  apiServer.use(
    mockEndpoint(getPlaylist, ({ request }) => {
      tokens.push(new URL(request.url).searchParams.get('s'));
      return reply();
    })
  );
  return tokens;
}

describe('apps/client/web: loadPlaylist', () => {
  it('reads with the share token, out of the key, and caches the playlist', async () => {
    const tokens = serve(() => HttpResponse.json(playlistDetail(LIST, [])));
    const client = createQueryClient();

    await expect(loadPlaylist(client, api, LIST, TOKEN)).resolves.toEqual({ kind: 'open' });

    expect(tokens).toEqual([TOKEN]);
    expect(client.getQueryData(playlistQueryOptions(api, LIST).queryKey)?.id).toBe(LIST);
  });

  it('says a dead share link is expired', async () => {
    serve(() => problemReply(ErrorCodes.SHARE_LINK_EXPIRED));

    await expect(loadPlaylist(createQueryClient(), api, LIST, TOKEN)).resolves.toEqual({
      kind: 'expired',
    });
  });

  it('lets any other failure reach the error page', async () => {
    serve(() => problemReply(ErrorCodes.INTERNAL));

    await expect(loadPlaylist(createQueryClient(), api, LIST, undefined)).rejects.toThrow();
  });
});
