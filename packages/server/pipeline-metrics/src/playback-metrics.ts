import { Counter, Histogram, type Registry } from 'prom-client';

/** First-party playback QoS from the player's beacons, with no label a client could multiply. */
export interface PlaybackMetrics {
  playbackStarts: Counter<string>;
  playbackWatchSeconds: Counter<string>;
  playbackRebufferingRatio: Histogram<string>;
}

export function createPlaybackMetrics(registry: Registry): PlaybackMetrics {
  const playbackStarts = new Counter({
    name: 'video_playback_starts_total',
    help: 'Playbacks that began, as the player reports them',
    registers: [registry],
  });

  const playbackWatchSeconds = new Counter({
    name: 'video_watch_time_seconds_total',
    help: 'Seconds of video actually played, as the player reports them',
    registers: [registry],
  });

  const playbackRebufferingRatio = new Histogram({
    name: 'video_rebuffering_ratio',
    help: 'Share of a reported playback segment spent stalled',
    buckets: [0, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1],
    registers: [registry],
  });

  return { playbackStarts, playbackWatchSeconds, playbackRebufferingRatio };
}
