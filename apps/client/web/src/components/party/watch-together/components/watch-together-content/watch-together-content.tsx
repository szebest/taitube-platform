import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Button, Checkbox, Label, ResponsiveModal, Skeleton } from '@kit/ui';
import { useNavigate } from '@tanstack/react-router';
import type { WatchPartyView } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl-formats';
import { useAccount } from '@vp/queries';
import { useState } from 'react';
import {
  canShareNatively,
  ShareLinkField,
  ShareNativeButton,
} from '#app/components/watch/share-dialog';
import { useDebouncedValue } from '#app/hooks/use-debounced-value';
import { useT } from '#app/lib/messages';
import { useInviteCandidates } from '../../hooks/use-invite-candidates';
import { useInvitePerson } from '../../hooks/use-invite-people';
import { useQuickWatchParty } from '../../hooks/use-quick-watch-party';
import { useRoomInviteLink } from '../../hooks/use-room-invite-link';
import type { WatchTogetherSource } from '../../types';
import { useWatchTogether } from '../../watch-together.context';
import { InvitePicker } from '../invite-picker/invite-picker';
import { PartyQr } from '../party-qr/party-qr';
import { WatchTogetherSettings } from '../watch-together-settings/watch-together-settings';

const SEARCH_DELAY_MS = 250;

function partyUrl(roomId: string): string {
  return new URL(`/parties/${encodeURIComponent(roomId)}`, window.location.origin).toString();
}

function Invite({ roomId }: { roomId: string }) {
  const { tOr } = useT();
  const [query, setQuery] = useState('');
  const settled = useDebouncedValue(query, SEARCH_DELAY_MS);
  const { data } = useInviteCandidates(roomId, settled);
  const invite = useInvitePerson(roomId);
  const sending = new Set(invite.isPending && invite.variables ? [invite.variables] : []);

  return (
    <section
      className="flex min-w-0 flex-col gap-inline"
      aria-label={tOr('party.shareInvite', {}, '')}
    >
      <h3 className="m-0 text-label">{tOr('party.shareInvite', {}, '')}</h3>
      <InvitePicker
        query={query}
        onQueryChange={setQuery}
        candidates={data?.items ?? []}
        sending={sending}
        onInvite={(userId) => invite.mutate(userId)}
      />
    </section>
  );
}

function startMsOf(source: WatchTogetherSource): number | undefined {
  return source.kind === 'video' && source.startMs ? source.startMs : undefined;
}

function withoutStart(source: WatchTogetherSource): WatchTogetherSource {
  return source.kind === 'video' ? { kind: 'video', videoId: source.videoId } : source;
}

function Ready({ room, title }: { room: WatchPartyView; title: string }) {
  const { tOr } = useT();
  const { format } = useFormat();
  const navigate = useNavigate();
  const { source, withStart, setWithStart, hostAs, setHostAs } = useWatchTogether('Ready');
  const account = useAccount();
  const roomId = room.id;
  const startAtMs = startMsOf(source);
  const gated = room.visibility === 'private' || room.hasPassword;
  const [skipsPassword, setSkipsPassword] = useState(true);
  const inviteLink = useRoomInviteLink(roomId, gated && skipsPassword);
  const link =
    gated && skipsPassword && inviteLink.data
      ? new URL(inviteLink.data.url, window.location.origin).toString()
      : partyUrl(roomId);

  return (
    <>
      <ShareLinkField
        link={link}
        label={tOr('party.shareLink', {}, '')}
        copyLabel={tOr('party.shareCopy', {}, '')}
        autoFocusCopy
      />
      {startAtMs !== undefined && (
        <Label className="flex items-center gap-inline">
          <Checkbox checked={withStart} onCheckedChange={(next) => setWithStart(next === true)} />
          {tOr(
            'party.shareStartAt',
            { time: unwrapOr(format(videoDuration(startAtMs / 1000)), '') },
            ''
          )}
        </Label>
      )}
      <div className="flex flex-wrap items-center gap-stack">
        <PartyQr link={link} label={tOr('party.shareQr', {}, '')} />
        {canShareNatively() && <ShareNativeButton title={title} link={link} />}
      </div>
      {gated && (
        <Label className="flex items-center gap-inline">
          <Checkbox
            checked={skipsPassword}
            onCheckedChange={(next) => setSkipsPassword(next === true)}
          />
          {tOr('party.linkSkipsPassword', {}, '')}
        </Label>
      )}
      {account?.channel && (
        <Label className="flex items-center gap-inline">
          <Checkbox
            checked={hostAs === 'channel'}
            onCheckedChange={(next) => setHostAs(next === true ? 'channel' : 'user')}
          />
          {tOr('party.hostAsChannel', {}, '')}
        </Label>
      )}
      <Invite roomId={roomId} />
      <WatchTogetherSettings room={room} source={source} hostAs={hostAs} />
      <Button
        tone="accent"
        variant="solid"
        onClick={() => void navigate({ to: '/parties/$roomId', params: { roomId }, search: {} })}
      >
        {tOr('party.shareGoToParty', {}, '')}
      </Button>
    </>
  );
}

function Making() {
  const { tOr } = useT();

  return (
    <div className="flex flex-col gap-inline" role="status" aria-busy="true">
      <span className="sr-only">{tOr('party.shareCreating', {}, '')}</span>
      <Skeleton shape="text" className="w-full" />
      <Skeleton shape="rect" className="size-40" />
    </div>
  );
}

function Failed({ retry }: { retry: () => void }) {
  const { tOr } = useT();

  return (
    <div className="flex flex-col items-start gap-inline" role="alert">
      <p className="m-0 text-body">{tOr('party.shareFailed', {}, '')}</p>
      <Button variant="outline" onClick={retry}>
        {tOr('party.shareRetry', {}, '')}
      </Button>
    </div>
  );
}

function Room() {
  const { tOr } = useT();
  const { source, withStart, hostAs } = useWatchTogether('Room');
  const room = useQuickWatchParty(withStart ? source : withoutStart(source), hostAs);

  return (
    <ResponsiveModal.Body className="flex min-w-0 flex-col gap-stack">
      {room.isError && <Failed retry={() => void room.refetch()} />}
      {room.isPending && <Making />}
      {room.data && <Ready room={room.data} title={tOr('party.shareTitle', {}, '')} />}
    </ResponsiveModal.Body>
  );
}

/** The dialog: the room's link to copy, share or scan, who to invite, and the way in. Lazy, with the QR code. */
export function WatchTogetherContent() {
  const { tOr } = useT();
  const { container } = useWatchTogether('Content');

  return (
    <ResponsiveModal.Content aria-describedby={undefined} container={container}>
      <ResponsiveModal.Header>
        <ResponsiveModal.Title>{tOr('party.shareTitle', {}, '')}</ResponsiveModal.Title>
      </ResponsiveModal.Header>
      <Room />
    </ResponsiveModal.Content>
  );
}
