import type { PlaybackEvent, PlaybackEventType } from '@vp/api-contracts';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { PlaybackProgress } from '../taitube-player-props';

export const HEARTBEAT_SECONDS = 30;

export interface PlaybackTrackerOptions {
  videoId: string;
  sessionUuid: string;
  send: (event: PlaybackEvent) => void;
  now?: () => number;
}

export function createPlaybackTracker({
  videoId,
  sessionUuid,
  send,
  now = Date.now,
}: PlaybackTrackerOptions) {
  let progress: PlaybackProgress = { currentTime: 0, duration: 0 };
  let currentRendition: string | undefined;
  let started = false;
  let finished = false;
  let playing = false;
  let visible = true;
  let stalledAt: number | undefined;
  let activeSince: number | undefined;
  let watchedMs = 0;
  let rebufferingMs = 0;

  const isActive = () => playing && visible && stalledAt === undefined;

  const settle = () => {
    const at = now();
    if (activeSince !== undefined) {
      watchedMs += at - activeSince;
    }
    if (stalledAt !== undefined) {
      rebufferingMs += at - stalledAt;
    }
    activeSince = isActive() ? at : undefined;
    if (stalledAt !== undefined) {
      stalledAt = at;
    }
  };

  const emit = (eventType: PlaybackEventType) => {
    const { currentTime, duration } = progress;
    if (!(duration > 0)) {
      return;
    }

    send({
      videoId,
      sessionUuid,
      eventType,
      currentTime,
      duration,
      rebufferingMs: Math.round(rebufferingMs),
      watchedSeconds: watchedMs / MS_PER_SECOND,
      rendition: currentRendition,
    });
    watchedMs = 0;
    rebufferingMs = 0;
  };

  const flushSegment = () => {
    settle();
    if (started && !finished && (watchedMs > 0 || rebufferingMs > 0)) {
      emit('heartbeat');
    }
  };

  return {
    play(next: PlaybackProgress) {
      progress = next;
      finished = false;
      if (stalledAt !== undefined) {
        settle();
        stalledAt = undefined;
        emit('rebuffer');
      }
      playing = true;
      if (!started) {
        started = true;
        emit('playback_start');
      }
      settle();
    },

    pause(next: PlaybackProgress) {
      progress = next;
      flushSegment();
      playing = false;
      settle();
    },

    waiting() {
      if (!playing || stalledAt !== undefined) {
        return;
      }
      settle();
      stalledAt = now();
      activeSince = undefined;
    },

    visibility(next: boolean) {
      if (visible === next) {
        return;
      }
      if (!next) {
        flushSegment();
      }
      visible = next;
      settle();
    },

    timeUpdate(next: PlaybackProgress) {
      progress = next;
      settle();
      if (started && watchedMs >= HEARTBEAT_SECONDS * MS_PER_SECOND) {
        emit('heartbeat');
      }
    },

    rendition(label: string) {
      const changed = label !== currentRendition;
      currentRendition = label;
      if (changed && started) {
        emit('quality_change');
      }
    },

    end(next: PlaybackProgress) {
      progress = next;
      settle();
      if (started && !finished) {
        emit('playback_ended');
      }
      finished = true;
      playing = false;
      settle();
    },

    dispose() {
      settle();
      flushSegment();
      playing = false;
    },
  };
}

export type PlaybackTracker = ReturnType<typeof createPlaybackTracker>;
