import { usePlaybackSession } from '#app/hooks/use-playback-queue';

/** A box the one player sits over: the stage's, or the mini player's. It holds no player, so the video never moves. */
export function PlayerSlot() {
  const { registerSlot } = usePlaybackSession();

  return <div ref={(slot) => (slot ? registerSlot(slot) : undefined)} className="size-full" />;
}
