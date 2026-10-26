import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { NotifyProcessingJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createNotifyProcessingProcessor } from '../notify-processing';
import {
  CREATOR_ID,
  logger,
  notificationsOf,
  saveSwitches,
  seedCreator,
  seedVideo,
  videoId,
} from './notification-harness';

describe('apps/server/worker/stages: notify-processing', () => {
  let repositories: InMemoryRepositories;

  const notify = async (outcome: 'ready' | 'failed', id = videoId(1)) => {
    const job: QueueJob<NotifyProcessingJob> = {
      id: `${id}--notify-processing--${outcome}`,
      name: 'notify-processing',
      data: { videoId: id, outcome },
    };
    return expectOk(await createNotifyProcessingProcessor({ repositories, logger })(job));
  };

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await seedCreator(repositories);
    await seedVideo(repositories, videoId(1), { title: 'Dinner' });
  });

  it.each(['ready', 'failed'] as const)('tells the uploader the video is %s', async (outcome) => {
    await notify(outcome);

    expect(await notificationsOf(repositories, CREATOR_ID)).toMatchObject([
      { kind: 'processing', videoId: videoId(1), payload: { outcome, videoTitle: 'Dinner' } },
    ]);
  });

  it('says nothing when the uploader switched processing notices off', async () => {
    await saveSwitches(repositories, CREATOR_ID, { processingFinished: false });

    expect(await notify('ready')).toMatchObject({ recorded: false });
    expect(await notificationsOf(repositories, CREATOR_ID)).toEqual([]);
  });

  it('says it once when the job runs again', async () => {
    await notify('ready');
    await notify('ready');

    expect(await notificationsOf(repositories, CREATOR_ID)).toHaveLength(1);
  });

  it('skips a video that is gone', async () => {
    expect(await notify('ready', videoId(9))).toMatchObject({ recorded: false });
  });
});
