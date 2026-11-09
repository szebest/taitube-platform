import { useLocation, useNavigate } from '@tanstack/react-router';
import type { WatchPartyPreviewView } from '@vp/api-contracts';
import { EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { PartyPermissionsProvider, usePermissions } from '@vp/permissions-react';
import { selectPartyPermissions, useAccount, useWatchPartySocket } from '@vp/queries';
import { Badge } from '@vp/ui';
import { useState } from 'react';
import {
  PartyRoom,
  type PartyRoomLayout,
  type PartyRoomTab,
} from '#app/components/party/party-room';
import { PlayerChannelProvider } from '#app/components/player/taitube-player';
import { usePartyClock } from '#app/features/watch-party/hooks/use-party-clock';
import { useUpgradePartySeat } from '#app/features/watch-party/hooks/use-upgrade-party-seat';
import { API_PUBLIC_URL } from '#app/lib/config';
import { PartyControls } from '../party-controls/party-controls';
import { PartyLayoutMenu } from '../party-layout-menu/party-layout-menu';
import { PartyPanel } from '../party-panel/party-panel';
import { PartyStage } from '../party-stage/party-stage';

const ENDED_COPY = {
  kicked: 'party.previewKicked',
  superseded: 'party.previewSuperseded',
  closed: 'party.previewClosedTitle',
} as const;

const PHASE_COPY = {
  lobby: 'party.phaseLobby',
  playing: 'party.phasePlaying',
  paused: 'party.phasePaused',
  finished: 'party.phaseFinished',
} as const;

interface PartyRoomViewProps {
  roomId: string;
  /** What the server rendered, shown until the socket says hello. */
  preview: Pick<WatchPartyPreviewView, 'name' | 'owner'>;
}

/** A member's party page: the stage on the room clock, its controls, and the panel, behind the room ability. */
export function PartyRoomView({ roomId, preview }: PartyRoomViewProps) {
  const [layout, setLayout] = useState<PartyRoomLayout>('side');
  const [tab, setTab] = useState<PartyRoomTab>('chat');

  const href = useLocation({ select: (location) => location.href });
  const navigate = useNavigate();
  const { tOr } = useT();
  const { userContext } = usePermissions();
  const account = useAccount();
  const upgrade = useUpgradePartySeat(roomId);
  const now = usePartyClock();
  const socket = useWatchPartySocket({ roomId, apiUrl: API_PUBLIC_URL });
  const { state } = socket;

  const { permissions, topPosition } = selectPartyPermissions(state, now);
  const room = state.room ?? preview;
  const ownerKey = room.owner.memberKey;
  const present = state.roster.length + state.guests;

  const handleSignIn = () => {
    if (account) {
      upgrade.mutate();
      return;
    }
    void navigate({ to: '/login', search: { redirect: href } });
  };

  if (state.ended) {
    return (
      <EmptyState.Root>
        <EmptyState.Title>{tOr(ENDED_COPY[state.ended], {}, '')}</EmptyState.Title>
      </EmptyState.Root>
    );
  }

  return (
    <PlayerChannelProvider>
      <PartyPermissionsProvider
        userContext={userContext}
        viewer={{
          permissions,
          topPosition,
          isOwner: state.you?.memberKey === ownerKey,
          kind: state.you?.kind ?? null,
        }}
      >
        <PartyRoom.Root layout={layout}>
          <PartyRoom.Header>
            <h1 className="m-0 text-title-lg">{room.name}</h1>
            <span className="text-body-sm text-fg-muted">
              {tOr('party.ownerBy', { name: room.owner.name }, '')}
            </span>
            <Badge size="sm" variant="soft" tone="neutral">
              {tOr(PHASE_COPY[state.playback.phase], {}, '')}
            </Badge>
            {present > 0 && (
              <span className="text-body-sm text-fg-muted">
                {tOr('party.roomPresent', { count: present }, '')}
              </span>
            )}
            <div className="ms-auto">
              <PartyLayoutMenu layout={layout} onLayoutChange={setLayout} />
            </div>
          </PartyRoom.Header>
          <PartyRoom.Stage>
            <PartyStage socket={socket} />
            <PartyControls socket={socket} />
          </PartyRoom.Stage>
          <PartyPanel
            roomId={roomId}
            socket={socket}
            tab={tab}
            onTabChange={setTab}
            onSignIn={handleSignIn}
          />
        </PartyRoom.Root>
      </PartyPermissionsProvider>
    </PlayerChannelProvider>
  );
}
