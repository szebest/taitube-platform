import { portBoardQueues } from '@vp/adapters/bullmq';
import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import type { JobQueue } from '@vp/core/ports';
import fastify from 'fastify';
import { bullBoardPlugin } from '../bull-board';

describe('apps/api/composition: Bull Board', () => {
  it('serves the operator UI over the queues it is handed, under its base path', async () => {
    const boardQueues = vi.fn((queues: Iterable<JobQueue>) => portBoardQueues(queues));
    const app = fastify();
    await app.register(
      bullBoardPlugin({
        basePath: '/admin/queues',
        queues: [new InMemoryJobQueue('probe'), new InMemoryJobQueue('notify')],
        boardQueues,
      }),
      { prefix: '/admin/queues' }
    );

    const page = await app.inject({ method: 'GET', url: '/admin/queues' });

    expect(page.statusCode).toBe(200);
    expect(boardQueues.mock.calls[0]?.[0]).toHaveLength(2);
    await app.close();
  });
});
