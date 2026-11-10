import { ApiError } from '@vp/api-client';
import type { MyInviteView } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { Format, useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { Avatar, Button, cn, useToast } from '@vp/ui';
import { RoleBadge } from '#app/components/team/role-badge';
import { useAcceptInvite, useDeclineInvite } from '#app/features/team/hooks/use-answer-invite';

type Refusal = 'studio.invitesClosed' | 'studio.invitesGone';

function refusalOf(error: unknown): Refusal | undefined {
  if (!(error instanceof ApiError)) return undefined;
  switch (error.code) {
    case ErrorCodes.CHANNEL_INVITE_NOT_PENDING:
      return 'studio.invitesClosed';
    case ErrorCodes.CHANNEL_INVITE_NOT_FOUND:
      return 'studio.invitesGone';
    default:
      return undefined;
  }
}

export interface InviteCardProps {
  invite: MyInviteView;
  /** The invite a notification opened. */
  opened: boolean;
}

/** One invite to a team: the channel, the role with what it can do, who sent it and when it lapses, to accept or decline. */
export function InviteCard({ invite, opened }: InviteCardProps) {
  const { tOr } = useT();
  const toast = useToast();
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const { channel, role } = invite;
  const busy = accept.isPending || decline.isPending;

  const answer = async (verb: 'accepted' | 'declined') => {
    const answered = await fromPromise(
      () => (verb === 'accepted' ? accept : decline).mutateAsync(invite.id),
      (cause) => cause
    );
    if (isOk(answered)) {
      toast({
        tone: 'success',
        title:
          verb === 'accepted'
            ? tOr('studio.invitesAccepted', { name: channel.displayName }, '')
            : tOr('studio.invitesDeclined', { name: channel.displayName }, ''),
      });
      return;
    }

    const known = refusalOf(answered.error);
    toast({
      tone: 'danger',
      title: known
        ? tOr(known, {}, '')
        : tOr(
            verb === 'accepted' ? 'studio.invitesAcceptFailed' : 'studio.invitesDeclineFailed',
            {},
            ''
          ),
    });
  };

  return (
    <li
      aria-current={opened ? 'true' : undefined}
      className={cn(
        'flex flex-wrap items-center justify-between gap-stack rounded-card border border-border p-inset-card',
        opened && 'border-accent'
      )}
    >
      <div className="flex min-w-0 items-start gap-inline">
        <Avatar.Root>
          {channel.avatarUrl ? <Avatar.Image src={channel.avatarUrl} alt="" /> : null}
          <Avatar.Fallback aria-hidden="true">
            {channel.displayName.slice(0, 1).toUpperCase()}
          </Avatar.Fallback>
        </Avatar.Root>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-label">{channel.displayName}</span>
          <span className="text-caption text-fg-muted">@{channel.handle}</span>
          <span className="flex flex-wrap items-center gap-inline">
            <RoleBadge channelRole={role}>{tOr('studio.teamRole', { role }, '')}</RoleBadge>
            <span className="text-caption">{tOr('studio.teamRoleSummary', { role }, '')}</span>
          </span>
          <span className="text-caption text-fg-muted">
            {invite.invitedByName === null
              ? tOr('studio.invitesInvitedByUnknown', {}, '')
              : tOr('studio.invitesInvitedBy', { name: invite.invitedByName }, '')}
            {' · '}
            {tOr('studio.invitesExpires', {}, '')}{' '}
            <time dateTime={invite.expiresAt}>
              <Format value={{ type: 'relative', value: invite.expiresAt }} />
            </time>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-inline">
        <Button
          variant="outline"
          disabled={busy}
          aria-label={tOr('studio.invitesDeclineLabel', { name: channel.displayName }, '')}
          onClick={() => answer('declined')}
        >
          {tOr('studio.invitesDecline', {}, '')}
        </Button>
        <Button
          variant="solid"
          tone="accent"
          disabled={busy}
          aria-label={tOr('studio.invitesAcceptLabel', { name: channel.displayName }, '')}
          onClick={() => answer('accepted')}
        >
          {tOr('studio.invitesAccept', {}, '')}
        </Button>
      </div>
    </li>
  );
}
