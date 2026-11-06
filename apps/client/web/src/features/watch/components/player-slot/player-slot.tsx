import { usePlaybackSession } from '#app/features/watch/hooks/use-playback-queue';

/** Where the player is on this page: the element it lives in moves in when this mounts, so playback carries on. */
export function PlayerSlot() {
  const { host, park } = usePlaybackSession();

  return (
    <div
      ref={(slot) => {
        if (!(slot && host && park)) {
          return;
        }

        if (host.parentElement !== slot) {
          slot.append(host);
        }

        return () => {
          if (host.parentElement === slot) {
            park.append(host);
          }
        };
      }}
    />
  );
}
