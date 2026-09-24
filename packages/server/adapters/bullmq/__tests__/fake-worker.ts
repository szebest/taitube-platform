import type { Job, Worker, WorkerOptions } from 'bullmq';

export type WorkerHandler = (job: Job) => Promise<unknown>;
type FailedListener = (job: Job | undefined, err: Error) => void;
type StalledListener = (jobId: string) => void;
type Listener = FailedListener | StalledListener;

export const workers: FakeWorker[] = [];

export class FakeWorker {
  private readonly listeners = new Map<string, Listener[]>();
  closedWaiting: boolean | undefined;

  constructor(
    readonly queueName: string,
    readonly handler: WorkerHandler,
    readonly options: WorkerOptions
  ) {
    workers.push(this);
  }

  on(event: string, listener: Listener): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push(listener);
    this.listeners.set(event, existing);
    return this;
  }

  emitFailed(job: Job | undefined, err: Error): void {
    for (const listener of this.listeners.get('failed') ?? [])
      (listener as FailedListener)(job, err);
  }

  emitStalled(jobId: string): void {
    for (const listener of this.listeners.get('stalled') ?? [])
      (listener as StalledListener)(jobId);
  }

  async close(waitForActive?: boolean): Promise<void> {
    this.closedWaiting = waitForActive;
  }

  asWorker(): Worker {
    return this as unknown as Worker;
  }
}

export function fakeWorkerFactory(
  name: string,
  handler: WorkerHandler,
  options: WorkerOptions
): Worker {
  return new FakeWorker(name, handler, options).asWorker();
}
