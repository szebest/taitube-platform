import type { Job, Queue } from 'bullmq';

export interface FakeJobInit {
  id?: string;
  name?: string;
  data?: unknown;
  attemptsMade?: number;
  state?: string;
  childrenValues?: Record<string, unknown>;
}

export function fakeJob(init: FakeJobInit = {}): Job {
  const job = {
    id: init.id ?? 'job-1',
    name: init.name ?? 'probe',
    data: init.data ?? {},
    attemptsMade: init.attemptsMade ?? 0,
    opts: { attempts: 3, priority: 5 },
    progress: [] as Array<number | object>,
    getState: async () => init.state ?? 'completed',
    updateProgress: async (progress: number | object) => {
      job.progress.push(progress);
    },
    getChildrenValues: async () => init.childrenValues,
  };
  return job as unknown as Job;
}

export interface FakeQueueInit {
  name?: string;
  prefix?: string;
  jobs?: Job[];
  counts?: Record<string, number>;
  schedulers?: Array<Record<string, unknown>>;
  status?: string;
  failClient?: boolean;
}

export class FakeQueue {
  readonly name: string;
  readonly opts: { connection: { host: string; port: number }; prefix: string };
  readonly metaValues = { version: 'bullmq' };
  readonly added: Array<{ name: string; data: unknown; opts: Record<string, unknown> }> = [];

  paused = false;
  countedStates: string[] = [];
  closed = false;

  constructor(private readonly init: FakeQueueInit = {}) {
    this.name = init.name ?? 'probe';
    this.opts = {
      connection: { host: 'fake', port: 6379 },
      prefix: init.prefix ?? 'bull',
    };
  }

  getBackend(): { client: Promise<{ status: string }> } {
    if (this.init.failClient) return { client: Promise.reject(new Error('no connection')) };
    return { client: Promise.resolve({ status: this.init.status ?? 'ready' }) };
  }

  async add(name: string, data: unknown, opts: Record<string, unknown>): Promise<Job> {
    this.added.push({ name, data, opts });
    return fakeJob({ id: (opts.jobId as string) ?? 'job-1', name, data });
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.init.jobs?.find((j) => j.id === id);
  }

  async getJobs(): Promise<Job[]> {
    return this.init.jobs ?? [];
  }

  async getJobCounts(...states: string[]): Promise<Record<string, number>> {
    this.countedStates = states;
    return this.init.counts ?? {};
  }

  async isPaused(): Promise<boolean> {
    return this.paused;
  }

  async pause(): Promise<void> {
    this.paused = true;
  }

  async resume(): Promise<void> {
    this.paused = false;
  }

  async upsertJobScheduler(
    id: string,
    repeat: Record<string, unknown>,
    template?: Record<string, unknown>
  ): Promise<unknown> {
    return { id, repeat, template };
  }

  async getJobSchedulers(): Promise<Array<Record<string, unknown>>> {
    return this.init.schedulers ?? [];
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  asQueue(): Queue {
    return this as unknown as Queue;
  }
}
