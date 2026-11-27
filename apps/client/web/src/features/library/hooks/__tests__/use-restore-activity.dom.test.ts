import { restorePlaylistActivity } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useRestoreActivity } from '../use-restore-activity';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);
const ACTIVITY = uuid(9101);

function restoreWith(reply: () => Response) {
  const restored: string[] = [];
  apiServer.use(
    mockEndpoint(restorePlaylistActivity, ({ params }) => {
      restored.push(`${params.id} ${params.activityId}`);
      return reply();
    })
  );
  const client = createQueryClient();
  client.setQueryData(libraryKeys.playlist(LIST), {});
  const { result, show } = renderWithToasts(() => useRestoreActivity(LIST), client);
  return {
    client,
    show,
    restored,
    restore: () => result.current.mutateAsync(ACTIVITY).catch(() => undefined),
  };
}

describe('apps/client/web: useRestoreActivity', () => {
  it('asks for the entry back, says so and marks the playlist stale', async () => {
    const { client, show, restored, restore } = restoreWith(
      () => new HttpResponse<null>(null, { status: 204 })
    );

    await restore();

    expect(restored).toEqual([`${LIST} ${ACTIVITY}`]);
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Put it back at the end of the playlist' })
    );
    expect(client.getQueryState(libraryKeys.playlist(LIST))?.isInvalidated).toBe(true);
  });

  it('says why when the video is already on the playlist', async () => {
    const { client, show, restore } = restoreWith(() =>
      problemReply(ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE)
    );

    await restore();

    expect(show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));
    expect(show).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Put it back at the end of the playlist' })
    );
    expect(client.getQueryState(libraryKeys.playlist(LIST))?.isInvalidated).toBe(true);
  });
});
