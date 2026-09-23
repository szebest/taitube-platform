import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { MS_PER_SECOND } from '@vp/domain/time';
import { type Result, fromPromise, ignore, isErr, ok } from '@vp/result';

export interface HeartbeatOptions {
  path: string;
  intervalMs: number;
  now: () => number;
}

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

/**
 * The liveness file, and the only thing that writes it. The probe computes
 * `$(( $(date +%s) - $(cat heartbeat) ))`, so the format is integer epoch seconds and a newline;
 * anything else is a shell syntax error, and the probe fails the pod.
 */
export class Heartbeat {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly options: HeartbeatOptions) {}

  async beat(): Promise<Result<void, Error>> {
    const { path: file, now } = this.options;
    const dir = await fromPromise(() => fs.mkdir(path.dirname(file), { recursive: true }), toError);
    if (isErr(dir)) return dir;
    return fromPromise(() => fs.writeFile(file, `${Math.floor(now() / MS_PER_SECOND)}\n`), toError);
  }

  /** A worker that cannot write its first beat would be killed by the probe, so it does not start. */
  async start(): Promise<Result<void, Error>> {
    const first = await this.beat();
    if (isErr(first)) return first;

    this.timer = setInterval(() => void this.tick(), this.options.intervalMs);
    this.timer.unref?.();
    return ok();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async tick(): Promise<void> {
    ignore(
      await this.beat(),
      'a volume that turned read-only costs the probe its file, and the probe then restarts the pod'
    );
  }
}
