import { expectOk } from '@vp/testing/result';
import { InMemoryJobQueue } from '../../in-memory/in-memory-job-queue';
import { portBoardQueues } from '../port-board-queues';

describe('adapters/bullmq: port board queues', () => {
  it('reads paused state and counts straight off the port', async () => {
    const queue = new InMemoryJobQueue('package');
    await queue.add('job', {});
    const [board] = portBoardQueues([queue]);

    expect(board?.getName()).toBe('package');
    expect(await board?.isPaused()).toBe(false);
    expect(await board?.getJobCounts()).toMatchObject({ waiting: 1 });

    await board?.pause();
    expect(expectOk(await queue.isPaused())).toBe(true);

    await board?.resume();
    expect(expectOk(await queue.isPaused())).toBe(false);
  });

  it('lists no jobs, because a port carries no BullMQ job record', async () => {
    const queue = new InMemoryJobQueue('probe');
    await queue.add('job', {});
    const [board] = portBoardQueues([queue]);

    expect(await board?.getJobs(['waiting'])).toEqual([]);
  });

  it.each(['empty', 'promoteAll', 'obliterate'] as const)(
    'refuses %s, which only a BullMQ queue can honour',
    async (operation) => {
      const [board] = portBoardQueues([new InMemoryJobQueue('probe')]);

      await expect(board?.[operation]()).rejects.toThrow(/not backed by BullMQ/);
    }
  );
});
