import type { Job } from 'bullmq';

export type WorkerHandler = (job: Job) => Promise<unknown>;
export type FailedListener = (job: Job | undefined, err: Error) => void;

export const workers: FakeWorker[] = [];

export class FakeWorker {
  private readonly listeners = new Map<string, FailedListener[]>();
  closedWaiting: boolean | undefined;

  constructor(
    readonly queueName: string,
    readonly handler: WorkerHandler,
    readonly options: Record<string, unknown>
  ) {
    workers.push(this);
  }

  on(event: string, listener: FailedListener): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push(listener);
    this.listeners.set(event, existing);
    return this;
  }

  emitFailed(job: Job | undefined, err: Error): void {
    for (const listener of this.listeners.get('failed') ?? []) listener(job, err);
  }

  async close(waitForActive?: boolean): Promise<void> {
    this.closedWaiting = waitForActive;
  }
}
