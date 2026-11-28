import { removePlaylistCollaborator, revokePlaylistInvite } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import {
  playlistCollaboratorsQueryOptions,
  playlistInvitesQueryOptions,
} from '#app/features/library/api/playlist-queries';
import { useCollaboratorChanges } from '../use-collaborator-changes';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);
const NO_CONTENT = () => new HttpResponse<null>(null, { status: 204 });

describe('apps/client/web: useCollaboratorChanges', () => {
  it.each([
    {
      change: 'removing a collaborator',
      run: (client: ReturnType<typeof createQueryClient>) =>
        renderWithToasts(
          () => useCollaboratorChanges(LIST).remove,
          client
        ).result.current.mutateAsync(uuid(8001)),
    },
    {
      change: 'revoking an invite',
      run: (client: ReturnType<typeof createQueryClient>) =>
        renderWithToasts(
          () => useCollaboratorChanges(LIST).revoke,
          client
        ).result.current.mutateAsync(uuid(8501)),
    },
  ])('marks the seats and the invites stale after $change', async ({ run }) => {
    apiServer.use(
      mockEndpoint(removePlaylistCollaborator, NO_CONTENT),
      mockEndpoint(revokePlaylistInvite, NO_CONTENT)
    );
    const client = createQueryClient();
    const seats = playlistCollaboratorsQueryOptions(api, LIST).queryKey;
    const invites = playlistInvitesQueryOptions(api, LIST).queryKey;
    client.setQueryData(seats, { items: [] });
    client.setQueryData(invites, { items: [] });

    await run(client);

    expect(client.getQueryState(seats)?.isInvalidated).toBe(true);
    expect(client.getQueryState(invites)?.isInvalidated).toBe(true);
  });
});
