import { EmptyState } from '@kit/components';
import { Badge, BrandScope } from '@kit/ui';
import { useLocation, useNavigate } from '@tanstack/react-router';
import type { WatchPartyPreviewView } from '@vp/api-contracts';
import { PartyPermissionsProvider, usePermissions } from '@vp/permissions-react';
import { selectPartyPermissions, useAccount, useWatchPartySocket } from '@vp/queries';
import { useState } from 'react';
import { PartyRoom, type PartyRoomTab } from '#app/components/party/party-room';
import { PlayerChannelProvider } from '#app/components/player/taitube-player';
import { usePartyClock } from '#app/features/watch-party/hooks/use-party-clock';
import { usePartyPreferences } from '#app/features/watch-party/hooks/use-party-preferences';
import { useUpgradePartySeat } from '#app/features/watch-party/hooks/use-upgrade-party-seat';
import { API_PUBLIC_URL } from '#app/lib/config';
import { useT } from '#app/lib/messages';
import { PartyAccentMenu } from '../party-accent-menu/party-accent-menu';
import { PartyControls } from '../party-controls/party-controls';
import { PartyLayoutMenu } from '../party-layout-menu/party-layout-menu';
import { PartyPanel } from '../party-panel/party-panel';
import { PartyReactionBar, PartyReactionOverlay } from '../party-reactions/party-reactions';
import { PartyRoleEditor } from '../party-role-editor/party-role-editor';
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
  preview: Pick<WatchPartyPreviewView, 'name' | 'owner' | 'accent'>;
}

/** A member's party page: the stage on the room clock, its controls, and the panel, behind the room ability. */
export function PartyRoomView({ roomId, preview }: PartyRoomViewProps) {
  const [preferences, changePreferences] = usePartyPreferences();
  const { layout } = preferences;
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
        <BrandScope color={room.accent}>
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
              <div className="ms-auto flex items-center gap-inline">
                <PartyRoleEditor roomId={roomId} socket={socket} />
                <PartyAccentMenu roomId={roomId} socket={socket} />
                <PartyLayoutMenu preferences={preferences} onChange={changePreferences} />
              </div>
            </PartyRoom.Header>
            <PartyRoom.Stage>
              <PartyStage
                socket={socket}
                overlay={
                  preferences.reactionOverlay && (
                    <PartyReactionOverlay roomId={roomId} socket={socket} />
                  )
                }
              />
              <PartyReactionBar socket={socket} />
              <PartyControls roomId={roomId} socket={socket} />
            </PartyRoom.Stage>
            <PartyPanel
              roomId={roomId}
              socket={socket}
              tab={tab}
              onTabChange={setTab}
              onSignIn={handleSignIn}
              systemLines={preferences.systemLines}
            />
          </PartyRoom.Root>
        </BrandScope>
      </PartyPermissionsProvider>
    </PlayerChannelProvider>
  );
}
