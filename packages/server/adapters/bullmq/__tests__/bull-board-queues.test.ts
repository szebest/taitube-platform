import { InMemoryJobQueue } from '../../in-memory/in-memory-job-queue';
import { bullBoardQueues } from '../bull-board-queues';
import { BullMqJobQueue } from '../bullmq-job-queue';
import { FakeQueue } from './fake-queue';

function bullMqQueue(name: string): BullMqJobQueue {
  return new BullMqJobQueue({ name, queue: new FakeQueue({ name }).asQueue() });
}

describe('adapters/bullmq: bull board queues', () => {
  it.each([
    { scenario: 'a BullMQ queue', queue: () => bullMqQueue('probe') },
    { scenario: 'a port with another driver behind it', queue: () => new InMemoryJobQueue('probe') },
  ])('presents $scenario under its own name', ({ queue }) => {
    const [board] = bullBoardQueues([queue()]);

    expect(board?.getName()).toBe('probe');
  });

  it('reads paused state and counts straight off the port', async () => {
    const queue = new InMemoryJobQueue('package');
    await queue.add('job', {});
    const [board] = bullBoardQueues([queue]);

    expect(await board?.isPaused()).toBe(false);
    expect(await board?.getJobCounts()).toMatchObject({ waiting: 1 });

    await board?.pause();
    expect(await queue.isPaused()).toBe(true);

    await board?.resume();
    expect(await queue.isPaused()).toBe(false);
  });

  it('lists no jobs for a port that is not BullMQ', async () => {
    const queue = new InMemoryJobQueue('probe');
    await queue.add('job', {});
    const [board] = bullBoardQueues([queue]);

    expect(await board?.getJobs(['waiting'])).toEqual([]);
  });

  it('yields nothing when there is no queue at all', () => {
    expect(bullBoardQueues([])).toEqual([]);
  });
});
