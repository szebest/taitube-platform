import { createBullBoard } from '@bull-board/api';
import type { BaseAdapter } from '@bull-board/api/baseAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import type { JobQueue } from '@vp/core/ports';
import type { FastifyPluginCallback } from 'fastify';

export interface BullBoardOptions {
  basePath: string;
  queues: Iterable<JobQueue>;
  boardQueues: (queues: Iterable<JobQueue>) => BaseAdapter[];
}

/** The operator UI over every registered queue. The route that mounts it owns the admin gate. */
export function bullBoardPlugin(options: BullBoardOptions): FastifyPluginCallback {
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath(options.basePath);

  createBullBoard({ queues: options.boardQueues(options.queues), serverAdapter });

  return serverAdapter.registerPlugin();
}
