import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { SSE_PING_COMMENT, formatSseFrame } from '@vp/events';
import { type Result, ignore, isOk, tryCatch } from '@vp/result';

/**
 * One frame on the wire. A frame with a `coalesceKey` is lossy: under backpressure only the latest
 * one per key is kept. Every other frame is queued and never dropped.
 */
export interface SseFrame {
  id?: number;
  event: string;
  data: unknown;
  coalesceKey?: string;
}

/**
 * Reads the frames logged after an id, in id order. A connection that has one treats an `id`'d live
 * frame as a cue to read its log instead of writing it, because pub/sub can deliver ids out of order.
 */
export type SseResync = (afterId: number) => Promise<Result<SseLogRead, unknown>>;

/** `lastId` is the last row read, kept or not, so a row no frame came from is not read again. */
export interface SseLogRead {
  frames: SseFrame[];
  lastId: number;
}

export interface SseConnectionOptions {
  channel: string;
  userId?: string;
  resync?: SseResync;
  rawResponse: ServerResponse;
  heartbeatMs: number;
  idleTimeoutMs: number;
  maxPendingFrames: number;
  rememberedIds: number;
}

export class SseConnection extends EventEmitter {
  readonly channel: string;
  readonly userId?: string;
  private readonly res: ServerResponse;
  private readonly maxPendingFrames: number;
  private readonly rememberedIds: number;
  private readonly resync?: SseResync;
  private isConnecting = true;
  private isClosed = false;
  private isBackpressured = false;
  private readonly writtenIds = new Set<number>();
  private resyncCursor = 0;
  private isResyncing = false;
  private isResyncDue = false;
  private readonly connectBuffer: SseFrame[] = [];
  private readonly pendingLossy = new Map<string, SseFrame>();
  private readonly pendingQueue: SseFrame[] = [];
  private heartbeatTimer?: NodeJS.Timeout;
  private idleTimer?: NodeJS.Timeout;

  constructor(options: SseConnectionOptions) {
    super();
    this.channel = options.channel;
    this.userId = options.userId;
    this.res = options.rawResponse;
    this.maxPendingFrames = options.maxPendingFrames;
    this.rememberedIds = options.rememberedIds;
    this.resync = options.resync;

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, options.heartbeatMs);

    this.idleTimer = setTimeout(() => {
      this.close();
    }, options.idleTimeoutMs);

    this.res.on('drain', () => {
      this.handleDrain();
    });

    const cleanup = () => {
      this.close();
    };
    this.res.on('close', cleanup);
    this.res.on('error', cleanup);
  }

  sendOpening(frame: SseFrame): void {
    if (this.isClosed) return;
    this.write(frame);
  }

  onLiveEvent(frame: SseFrame): void {
    if (this.isClosed) return;

    if (this.isConnecting) {
      this.connectBuffer.push(frame);
      return;
    }

    this.takeLiveEvent(frame);
  }

  markLive(lastSentId: number): void {
    if (this.isClosed) return;
    this.resyncCursor = lastSentId;
    this.isConnecting = false;

    for (const frame of this.connectBuffer.splice(0)) {
      this.takeLiveEvent(frame);
    }
  }

  private takeLiveEvent(frame: SseFrame): void {
    if (frame.id === undefined) {
      this.dispatchLiveEvent(frame);
      return;
    }
    if (this.resync) {
      this.requestResync(this.resync);
      return;
    }
    if (this.writtenIds.has(frame.id)) return;

    this.dispatchLiveEvent(frame);
  }

  private requestResync(resync: SseResync): void {
    if (this.isResyncing) {
      this.isResyncDue = true;
      return;
    }

    this.isResyncing = true;
    void this.runResync(resync);
  }

  private async runResync(resync: SseResync): Promise<void> {
    do {
      this.isResyncDue = false;
      const read = await resync(this.resyncCursor);
      if (this.isClosed) return;
      if (!isOk(read)) {
        this.close();
        return;
      }
      for (const frame of read.value.frames) {
        if (frame.id !== undefined && frame.id <= this.resyncCursor) continue;
        this.dispatchLiveEvent(frame);
        if (this.isClosed) return;
      }
      this.resyncCursor = Math.max(this.resyncCursor, read.value.lastId);
    } while (this.isResyncDue);
    this.isResyncing = false;
  }

  private dispatchLiveEvent(frame: SseFrame): void {
    if (this.isBackpressured) {
      if (frame.coalesceKey !== undefined) {
        this.pendingLossy.set(frame.coalesceKey, frame);
      } else if (this.pendingQueue.length < this.maxPendingFrames) {
        this.pendingQueue.push(frame);
      } else {
        this.close();
      }
      return;
    }

    this.write(frame);
  }

  private handleDrain(): void {
    this.isBackpressured = false;

    for (const frame of this.pendingLossy.values()) {
      this.write(frame);
    }
    this.pendingLossy.clear();

    while (this.pendingQueue.length > 0 && !this.isBackpressured) {
      const frame = this.pendingQueue.shift();
      if (frame) this.write(frame);
    }
  }

  private write(frame: SseFrame): void {
    if (frame.id !== undefined) this.rememberWritten(frame.id);
    const { id, event, data } = frame;
    if (!this.writeDirect(formatSseFrame({ id, event, data }))) {
      this.isBackpressured = true;
    }
  }

  private rememberWritten(id: number): void {
    this.writtenIds.add(id);
    if (this.writtenIds.size <= this.rememberedIds) return;

    const [oldest] = this.writtenIds;
    if (oldest !== undefined) this.writtenIds.delete(oldest);
  }

  private sendHeartbeat(): void {
    if (this.isClosed) return;
    this.writeDirect(SSE_PING_COMMENT);
  }

  private writeDirect(chunk: string): boolean {
    if (this.isClosed || this.res.writableEnded || this.res.destroyed) {
      return false;
    }
    const written = tryCatch(
      () => this.res.write(chunk),
      () => null
    );
    if (isOk(written)) return written.value;

    this.close();
    return false;
  }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }

    if (!(this.res.writableEnded || this.res.destroyed)) {
      ignore(
        tryCatch(
          () => this.res.end(),
          () => null
        ),
        'the peer may already be gone, and a torn-down socket must not fail the shutdown'
      );
    }

    this.emit('close');
    this.removeAllListeners();
  }
}
