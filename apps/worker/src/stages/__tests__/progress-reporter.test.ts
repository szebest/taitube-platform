import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { createMetricsRegistry } from '@vp/observability';
import { createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { TranscodeProgressReporter } from '../progress-reporter';

describe('TranscodeProgressReporter', () => {
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  const logger = createLogger({
    format: 'json',
    service: 'progress-reporter-test',
    level: 'silent',
  });
  const videoId = uuidv7();

  let clock: number;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    clock = 1_000_000;
  });

  it('throttles progress to 1 per 2s per rendition and persists only every 10%', async () => {
    const reporter = new TranscodeProgressReporter({
      cache,
      repositories,
      metrics: createMetricsRegistry(),
      videoId,
      rendition: '720p',
      logger,
      now: () => clock,
    });

    await reporter.report(5);
    let events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.length).toBe(0);
    expect(cache.publishedMessages.length).toBe(1);

    await reporter.report(8);
    expect(cache.publishedMessages.length).toBe(1);

    clock += 2500;
    await reporter.report(12);

    events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.length).toBe(1);
    const event0 = events[0];
    expect(event0?.type).toBe('progress');
    expect(event0?.payload).toMatchObject({ percent: 12 });
    expect(cache.publishedMessages.length).toBe(2);

    clock += 2500;
    await reporter.report(16);

    events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.length).toBe(1);
    expect(cache.publishedMessages.length).toBe(3);

    clock += 2500;
    await reporter.report(22);

    events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.length).toBe(2);
    expect(events[1]?.payload).toMatchObject({ percent: 22 });
    expect(cache.publishedMessages.length).toBe(4);
  });
});
