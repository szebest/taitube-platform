import { useLocation, useNavigate } from '@tanstack/react-router';
import type { WatchPartyPreviewView } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { failureCode } from '@vp/queries';
import { PartyJoinPanel, type PartyPasswordError } from '#app/components/party/party-join-panel';
import { useJoinParty } from '#app/features/watch-party/hooks/use-join-party';
import { useJoinPartyAsGuest } from '#app/features/watch-party/hooks/use-join-party-as-guest';

interface PartyJoinProps {
  roomId: string;
  preview: WatchPartyPreviewView;
  invite?: string;
}

const PASSWORD_ERRORS: Partial<Record<string, PartyPasswordError>> = {
  [ErrorCodes.WATCH_PARTY_PASSWORD_INVALID]: 'invalid',
  [ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED]: 'locked',
};

/** What a visitor with no seat sees on a party URL: the preview and the one way in the room allows them. */
export function PartyJoin({ roomId, preview, invite }: PartyJoinProps) {
  const href = useLocation({ select: (location) => location.href });
  const navigate = useNavigate();
  const join = useJoinParty(roomId);
  const joinAsGuest = useJoinPartyAsGuest(roomId);
  const { canJoin, actions } = preview.viewer;

  const state = canJoin === 'member' ? 'yes' : canJoin;
  const passwordError = join.error ? (PASSWORD_ERRORS[failureCode(join.error)] ?? null) : null;

  return (
    <PartyJoinPanel
      state={state}
      name={preview.name}
      ownerName={preview.owner.name}
      videoTitle={preview.currentVideo?.title}
      posterUrl={preview.currentVideo?.thumbnailUrl}
      faces={preview.roster.faces}
      total={preview.roster.total}
      actions={actions}
      full={{ present: preview.presentCount, capacity: preview.effectiveCapacity }}
      passwordError={passwordError}
      pending={join.isPending || joinAsGuest.isPending}
      onJoin={(password) => join.mutate({ password, invite })}
      onWatchAsGuest={() => joinAsGuest.mutate(invite)}
      onSignIn={() => void navigate({ to: '/login', search: { redirect: href } })}
    />
  );
}
