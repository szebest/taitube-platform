import { Registry } from 'prom-client';
import { createPlaybackMetrics } from '../playback-metrics';

describe('createPlaybackMetrics', () => {
  it('exposes starts and watch time as counters and rebuffering as a ratio histogram', async () => {
    const registry = new Registry();
    const metrics = createPlaybackMetrics(registry);

    metrics.playbackStarts.inc();
    metrics.playbackWatchSeconds.inc(30);
    metrics.playbackRebufferingRatio.observe(0.02);

    const scrape = await registry.metrics();
    expect(scrape).toContain('video_playback_starts_total 1');
    expect(scrape).toContain('video_watch_time_seconds_total 30');
    expect(scrape).toContain('video_rebuffering_ratio_count 1');
  });
});
