import { fromPromise, ignore } from '@kit/result';
import type { PlayerCommands } from '#app/lib/player/player-port';
import { usePlayer } from '../player';
import { useCaptionsContext } from './use-captions';

export function usePlayerCommands(): PlayerCommands {
  const {
    play,
    pause,
    seek,
    setVolume,
    setMuted,
    setPlaybackRate,
    selectVideoRendition,
    requestFullscreen,
    exitFullscreen,
    requestPictureInPicture,
    exitPictureInPicture,
    requestControlsLock,
  } = usePlayer();
  const { commands } = useCaptionsContext();

  return {
    play,
    pause,
    seek,
    setVolume,
    setMuted,
    setPlaybackRate,
    selectVideoRendition,
    requestFullscreen,
    exitFullscreen,
    requestPictureInPicture: async () => {
      ignore(
        await fromPromise(
          async () => requestPictureInPicture(),
          (cause) => cause
        ),
        'a refused picture in picture leaves the video where it is'
      );
    },
    exitPictureInPicture: async () => {
      ignore(
        await fromPromise(
          async () => exitPictureInPicture(),
          (cause) => cause
        ),
        'a refused exit leaves the video in its window'
      );
    },
    requestControlsLock,
    ...commands,
  };
}
