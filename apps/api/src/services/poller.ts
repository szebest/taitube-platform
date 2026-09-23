import { type Result, ok } from '@vp/result';

/**
 * Samples on an interval once started, and not before: building one opens no timer, which is what
 * lets a test build the whole app without leaving a handle behind.
 */
export class Poller {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly poll: () => Promise<void>,
    private readonly intervalMs: number
  ) {}

  async start(): Promise<Result<void, never>> {
    if (this.timer) return ok();

    this.timer = setInterval(() => this.sample(), this.intervalMs);
    this.sample();
    return ok();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** A scrape is not a request: a sample that cannot be taken leaves the gauges where they were. */
  private sample(): void {
    this.poll().catch(() => {});
  }
}
