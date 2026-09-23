import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { createLogger, createMetricsRegistry } from '@vp/observability';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { beforeEach, describe, expect, it } from 'vitest';
import { TranscodeProgressReporter } from '../stages/progress-reporter';

describe('TranscodeProgressReporter (Ticket 15: AC 4)', () => {
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  const logger = createLogger({ service: 'progress-reporter-test', level: 'silent' });
  const videoId = uuidv7();

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
  });

  it('throttles progress to 1 per 2s per rendition and persists only every 10%', async () => {
    const reporter = new TranscodeProgressReporter({
      cache,
      repositories,
      metrics: createMetricsRegistry(),
      videoId,
      rendition: '720p',
      logger,
    });

    // Initial publish at 5% (time 0)
    await reporter.report(5);
    // At 5% (< 10%), should publish to Redis pub/sub but NOT persist in DB
    let events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.length).toBe(0);
    expect(cache.publishedMessages.length).toBe(1);

    // Rapid progress at 8% (within 2s) -> throttled completely
    await reporter.report(8);
    expect(cache.publishedMessages.length).toBe(1);

    // Fast-forward lastPublishTime to simulate 2.5s later
    (reporter as any).lastPublishTime = Date.now() - 2500;
    // Progress at 12% -> passes 10% decile boundary! Should persist and publish!
    await reporter.report(12);

    events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.length).toBe(1);
    const event0 = events[0];
    expect(event0?.type).toBe('progress');
    expect((event0?.payload as any)?.percent).toBe(12);
    expect(cache.publishedMessages.length).toBe(2);

    // Fast-forward another 2.5s, progress at 16% -> same decile (1), should publish but NOT persist
    (reporter as any).lastPublishTime = Date.now() - 2500;
    await reporter.report(16);

    events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.length).toBe(1); // Still 1 persisted
    expect(cache.publishedMessages.length).toBe(3);

    // Fast-forward another 2.5s, progress at 22% -> passes 20% decile boundary! Should persist!
    (reporter as any).lastPublishTime = Date.now() - 2500;
    await reporter.report(22);

    events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.length).toBe(2);
    const event1 = events[1];
    expect((event1?.payload as any)?.percent).toBe(22);
    expect(cache.publishedMessages.length).toBe(4);
  });
});
