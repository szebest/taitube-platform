import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { userChannel } from '@vp/events';
import { createLogger } from '@vp/logger';
import { createMetricsRegistry } from '@vp/observability';
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

  const newReporter = () =>
    new TranscodeProgressReporter({
      cache,
      repositories,
      metrics: createMetricsRegistry(),
      videoId,
      rendition: '720p',
      logger,
      now: () => clock,
    });

  it('throttles progress to 1 per 2s per rendition and persists only every 10%', async () => {
    const reporter = newReporter();

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

  it('tells the owner of the video each published tick, with no id', async () => {
    const ownerId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId,
      sourceKey: 'raw/source.mp4',
      status: 'PROCESSING',
    });

    await newReporter().report(40);

    expect(cache.publishedMessages).toContainEqual(
      expect.objectContaining({
        channel: userChannel(ownerId),
        message: JSON.stringify({
          type: 'video.processing',
          payload: {
            videoId,
            change: { kind: 'progress', rendition: '720p', percent: 40, overall: 40 },
          },
        }),
      })
    );
  });
});
