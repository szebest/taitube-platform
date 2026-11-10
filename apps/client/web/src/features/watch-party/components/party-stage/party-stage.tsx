import { useQuery } from '@tanstack/react-query';
import { ClientOnly } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { type WatchPartySocket, useApi, videoQueryOptions } from '@vp/queries';
import { Suspense, type ReactNode } from 'react';
import { PartyLobby } from '#app/components/party/party-lobby';
import { LazyTaitubePlayer } from '#app/components/player/taitube-player/taitube-player.lazy';
import { Stage } from '#app/components/watch/stage';
import { usePartyCountdown } from '#app/features/watch-party/hooks/use-party-countdown';
import { PartySyncOverlay } from '../party-sync-overlay/party-sync-overlay';

interface PartyStageProps {
  socket: WatchPartySocket;
  /** Drawn over the picture inside the player, so it follows it into fullscreen. */
  overlay?: ReactNode;
}

/** The room's picture: the lobby before the start, the player after, always on the room clock. */
export function PartyStage({ socket, overlay }: PartyStageProps) {
  const { state, serverNow, send } = socket;
  const api = useApi();
  const { tOr } = useT();
  const video = state.room?.currentVideo ?? null;
  const { data } = useQuery({
    ...videoQueryOptions(api, video?.id ?? ''),
    enabled: video !== null && state.playback.phase !== 'finished',
  });
  const countdown = usePartyCountdown(state.countdownEndsAt, serverNow);
  const me = state.roster.find((person) => person.memberKey === state.you?.memberKey);
  const { phase } = state.playback;

  if (phase === 'lobby' || countdown !== null) {
    return (
      <PartyLobby.Root posterUrl={video?.thumbnailUrl}>
        {countdown === null ? (
          <PartyLobby.Status startsAt={state.room?.scheduledFor ?? undefined} />
        ) : (
          <PartyLobby.Countdown seconds={countdown} />
        )}
        <PartyLobby.ReadyCheck
          members={state.roster.map((person) => ({
            key: person.memberKey,
            name: person.name,
            avatarUrl: person.avatarUrl,
            ready: person.ready,
          }))}
          guests={state.guests}
        />
        <PartyLobby.Actions
          ready={me?.ready ?? false}
          onToggleReady={() => send({ type: 'ready', ready: !me?.ready })}
          onStart={() =>
            send({ type: 'start', version: state.version, rolesVersion: state.rolesVersion })
          }
        />
      </PartyLobby.Root>
    );
  }

  return (
    <Stage.Root paused={phase !== 'playing'}>
      {phase === 'finished' || !video ? (
        <Stage.Status kind="unavailable">{tOr('party.phaseFinished', {}, '')}</Stage.Status>
      ) : (
        <ClientOnly fallback={<Stage.Status kind="loading" />}>
          <Suspense fallback={<Stage.Status kind="loading" />}>
            {data === undefined && <Stage.Status kind="loading" />}
            {data && !data.playbackUrl && <Stage.Status kind="unavailable" />}
            {data?.playbackUrl && (
              <Stage.Player>
                <LazyTaitubePlayer
                  key={data.playbackUrl}
                  videoId={video.id}
                  playbackUrl={data.playbackUrl}
                  posterUrl={data.posterUrl}
                  title={video.title}
                  controls={false}
                  overlay={
                    <>
                      <PartySyncOverlay socket={socket} />
                      {overlay}
                    </>
                  }
                />
              </Stage.Player>
            )}
          </Suspense>
        </ClientOnly>
      )}
    </Stage.Root>
  );
}
