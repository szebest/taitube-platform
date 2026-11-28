import { SectionError } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Badge, type BadgeTone, Button, Skeleton, useToast } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import type { PlaylistInviteView } from '@vp/api-contracts';
import type { PlaylistInviteState } from '@vp/domain';
import { useApi } from '@vp/queries';
import { playlistInvitesQueryOptions } from '#app/features/library/api/playlist-queries';
import { useCollaboratorChanges } from '#app/features/library/hooks/use-collaborator-changes';
import { useCopyLink } from '#app/hooks/use-copy-link';
import { useT } from '#app/lib/messages';

const STATE_VIEW = {
  active: { tone: 'success', usable: true },
  expired: { tone: 'neutral', usable: false },
  revoked: { tone: 'danger', usable: false },
  exhausted: { tone: 'neutral', usable: false },
} as const satisfies Record<PlaylistInviteState, { tone: BadgeTone; usable: boolean }>;

export interface PendingInvitesProps {
  playlistId: string;
}

/** Personal invites and links, newest first: who or what, its state and expiry, Copy and Revoke while it works. */
export function PendingInvites({ playlistId }: PendingInvitesProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const copyLink = useCopyLink();
  const showToast = useToast();
  const invites = useQuery(playlistInvitesQueryOptions(useApi(), playlistId));
  const { revoke } = useCollaboratorChanges(playlistId);

  const nameOf = ({ invitee }: PlaylistInviteView) =>
    invitee?.displayName ?? tOr('playlistPeople.linkInvite', {}, '');

  const copy = (token: string) =>
    copyLink(`${window.location.origin}/playlist-invite/${encodeURIComponent(token)}`);

  return (
    <section className="flex flex-col gap-stack" aria-labelledby="playlist-pending-invites">
      <h3 id="playlist-pending-invites" className="m-0 text-title">
        {tOr('playlistPeople.pendingTitle', {}, '')}
      </h3>
      {invites.isPending && <Skeleton aria-hidden="true" className="h-16 w-full" />}
      {invites.isError && (
        <SectionError.Root
          role="alert"
          retrying={invites.isFetching}
          onRetry={() => void invites.refetch()}
        >
          <SectionError.Message>{tOr('playlistPeople.loadFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {invites.isSuccess && invites.data.items.length === 0 && (
        <p className="m-0 text-body-sm text-fg-muted">
          {tOr('playlistPeople.pendingEmpty', {}, '')}
        </p>
      )}
      {invites.isSuccess && invites.data.items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {invites.data.items.map((invite) => {
            const name = nameOf(invite);
            const active = STATE_VIEW[invite.state].usable;
            return (
              <li key={invite.id} className="flex min-w-0 flex-wrap items-center gap-inline">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label">{name}</span>
                  <span className="text-caption text-fg-muted">
                    {tOr(
                      'playlistPeople.inviteMeta',
                      {
                        role: tOr('playlistPeople.role', { role: invite.role }, ''),
                        date: unwrapOr(format({ type: 'date', value: invite.expiresAt }), ''),
                      },
                      ''
                    )}
                    {invite.maxUses !== null && (
                      <>
                        {' · '}
                        {tOr(
                          'playlistPeople.usage',
                          { count: invite.useCount, max: invite.maxUses },
                          ''
                        )}
                      </>
                    )}
                  </span>
                </div>
                <Badge size="sm" tone={STATE_VIEW[invite.state].tone}>
                  {tOr('playlistPeople.inviteState', { state: invite.state }, '')}
                </Badge>
                {active && invite.invitee === null && (
                  <Button size="sm" variant="outline" onClick={() => void copy(invite.token)}>
                    {tOr('playlistPeople.copyInviteLink', {}, '')}
                  </Button>
                )}
                {active && (
                  <Button
                    size="sm"
                    variant="outline"
                    tone="danger"
                    aria-label={tOr('playlistPeople.revokeFor', { name }, '')}
                    onClick={() =>
                      revoke.mutate(invite.id, {
                        onSuccess: () =>
                          showToast({
                            tone: 'success',
                            title: tOr('playlistPeople.revoked', {}, ''),
                          }),
                      })
                    }
                  >
                    {tOr('playlistPeople.revoke', {}, '')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
