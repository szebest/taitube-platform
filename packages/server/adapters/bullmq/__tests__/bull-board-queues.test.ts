import { InMemoryJobQueue } from '../../in-memory/in-memory-job-queue';
import { bullBoardQueues } from '../bull-board-queues';
import { BullMqJobQueue } from '../bullmq-job-queue';
import { FakeQueue } from './fake-queue';

function bullMqQueue(name: string): BullMqJobQueue {
  return new BullMqJobQueue({ type: 'queue', name, queue: new FakeQueue({ name }).asQueue() });
}

describe('adapters/bullmq: bull board queues', () => {
  it.each([
    { scenario: 'a BullMQ queue', queue: () => bullMqQueue('probe') },
    {
      scenario: 'a port with another driver behind it',
      queue: () => new InMemoryJobQueue('probe'),
    },
  ])('presents $scenario under its own name', ({ queue }) => {
    const [board] = bullBoardQueues([queue()]);

    expect(board?.getName()).toBe('probe');
  });

  it('yields nothing when there is no queue at all', () => {
    expect(bullBoardQueues([])).toEqual([]);
  });
});
