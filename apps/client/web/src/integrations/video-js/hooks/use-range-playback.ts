import { useRef } from 'react';
import { useOfferedPlayerChannel } from '#app/lib/player/player-channel';
import type { PlaybackEnd, TaitubePlayerProps } from '#app/lib/player/taitube-player-props';
import { isBeforeRange, isPastRange, rangeStartSeconds } from '../playback-range';

type RangePlaybackProps = Pick<TaitubePlayerProps, 'range' | 'loop' | 'startTime'> & {
  onEnded?: (end: PlaybackEnd) => void;
};

/** Keeps a video inside its `range`: it starts at the range, and at the range's end loops back or stops and tells the caller and the channel. */
export function useRangePlayback({ range, loop, startTime, onEnded }: RangePlaybackProps) {
  const channel = useOfferedPlayerChannel();
  const stopped = useRef(false);

  const restart = (video: HTMLVideoElement) => {
    if (!range) {
      return;
    }

    stopped.current = false;
    video.currentTime = rangeStartSeconds(range);
  };

  const stop = (video: HTMLVideoElement) => {
    if (stopped.current) {
      return;
    }

    stopped.current = true;
    video.pause();
    onEnded?.({ duration: video.duration });
    channel?.end();
  };

  return {
    onLoadedMetadata: (video: HTMLVideoElement) => {
      stopped.current = false;
      const startAt = range ? rangeStartSeconds(range) : startTime;
      if (startAt) {
        video.currentTime = startAt;
      }
    },
    onTimeUpdate: (video: HTMLVideoElement) => {
      if (!range) {
        return;
      }

      if (isBeforeRange(range, video.currentTime)) {
        restart(video);
        return;
      }

      if (isPastRange(range, video.currentTime)) {
        if (loop) {
          restart(video);
        } else {
          stop(video);
        }
      }
    },
    onPlaying: (video: HTMLVideoElement) => {
      if (stopped.current) {
        restart(video);
      }
    },
    /** Whether the range took the end of the video: the caller reports the end of a video without one. */
    onVideoEnded: (video: HTMLVideoElement): boolean => {
      if (!range) {
        return false;
      }

      if (loop) {
        restart(video);
        void video.play();
        return true;
      }

      stop(video);
      return true;
    },
  };
}
