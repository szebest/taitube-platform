import { Button, Separator } from '@kit/ui';
import type { PlaylistView } from '@vp/api-contracts';
import { useLeavePlaylist } from '#app/features/library/hooks/use-collaborator-changes';
import type { PlaylistAbilities } from '#app/features/library/hooks/use-playlist-abilities';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';
import { CollaboratorRows } from './components/collaborator-rows/collaborator-rows';
import { InviteHandleForm } from './components/invite-handle-form/invite-handle-form';
import { InviteLinkForm } from './components/invite-link-form/invite-link-form';
import { PendingInvites } from './components/pending-invites/pending-invites';

const { UrlModal } = urlModals;

export interface CollaboratorsDialogProps {
  playlist: PlaylistView;
  abilities: PlaylistAbilities;
}

/**
 * `?modal=playlist-collaborators`: who works on the playlist. The owner changes roles, removes,
 * invites by handle or by link and revokes; a collaborator can leave.
 */
export function CollaboratorsDialog({ playlist, abilities }: CollaboratorsDialogProps) {
  const { tOr } = useT();
  const leave = useLeavePlaylist(playlist.id, playlist.title);

  const manageable = abilities.manageCollaborators;

  return (
    <UrlModal.Root id="playlist-collaborators">
      <UrlModal.Content size="lg">
        <UrlModal.Title>{tOr('playlistPeople.collaboratorsTitle', {}, '')}</UrlModal.Title>
        <UrlModal.Description>
          {tOr('playlistPeople.collaboratorsDescription', {}, '')}
        </UrlModal.Description>
        <UrlModal.Body className="flex flex-col gap-section">
          <CollaboratorRows playlist={playlist} manageable={manageable} />
          {manageable && (
            <>
              <Separator />
              <InviteHandleForm playlistId={playlist.id} />
              <InviteLinkForm playlistId={playlist.id} />
              <PendingInvites playlistId={playlist.id} />
            </>
          )}
        </UrlModal.Body>
        {abilities.leave && (
          <UrlModal.Footer>
            <Button
              variant="outline"
              tone="danger"
              loading={leave.isPending}
              onClick={() => leave.mutate()}
            >
              {tOr('playlistPeople.leave', {}, '')}
            </Button>
          </UrlModal.Footer>
        )}
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
