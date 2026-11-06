import { usePlaybackSession } from '../hooks/use-playback-queue';

/** Where the player is on this page: the element it lives in moves in when this mounts, so playback carries on. */
export function PlayerSlot() {
  const { host } = usePlaybackSession();

  return (
    <div
      ref={(slot) => {
        if (slot && host && host.parentElement !== slot) {
          slot.appendChild(host);
        }
      }}
    />
  );
}
