import { bufferedEndAt } from '#app/lib/player/buffered-end';
import type { PlayerState } from '#app/lib/player/player-port';
import { usePlayer } from '../player';
import { useCaptionsContext } from './use-captions';

export const AUTO_QUALITY = 'auto';

/** Reads the playback state a skin draws; it re-renders only when the selected value changes. */
export function usePlayerState<Selected>(select: (state: PlayerState) => Selected): Selected {
  const { state: captions } = useCaptionsContext();

  return usePlayer((state) =>
    select({
      paused: state.paused,
      buffering: state.waiting,
      ended: state.ended,
      currentTime: state.currentTime,
      duration: state.duration,
      bufferedEnd: bufferedEndAt(state.buffered, state.currentTime),
      volume: state.volume,
      muted: state.muted,
      playbackRate: state.playbackRate,
      fullscreen: state.isFullscreen,
      canFullscreen: state.fullscreenAvailability === 'available',
      pictureInPicture: state.isPictureInPicture,
      canPictureInPicture: state.pictureInPictureAvailability === 'available',
      controlsVisible: state.controlsVisible,
      renditions: state.videoRenditionList,
      quality: state.videoRenditionList.find(({ selected }) => selected)?.id ?? AUTO_QUALITY,
      activeHeight: state.activeVideoRendition?.height,
      ...captions,
    })
  );
}
