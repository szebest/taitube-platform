import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { SSE_PING_COMMENT, formatSseFrame } from '@vp/events';
import { ignore, isOk, tryCatch } from '@vp/result';

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

export interface SseConnectionOptions {
  channel: string;
  userId?: string;
  rawResponse: ServerResponse;
  heartbeatMs: number;
  idleTimeoutMs: number;
  maxPendingFrames: number;
}

export class SseConnection extends EventEmitter {
  readonly channel: string;
  readonly userId?: string;
  private readonly res: ServerResponse;
  private readonly maxPendingFrames: number;
  private isConnecting = true;
  private isClosed = false;
  private isBackpressured = false;
  private lastSentEventId = 0;
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

    if (frame.id && frame.id <= this.lastSentEventId) {
      return;
    }

    this.dispatchLiveEvent(frame);
  }

  markLive(lastSentId?: number): void {
    if (this.isClosed) return;
    if (lastSentId !== undefined) {
      this.lastSentEventId = Math.max(this.lastSentEventId, lastSentId);
    }
    this.isConnecting = false;

    for (const frame of this.connectBuffer.splice(0)) {
      if (frame.id && frame.id <= this.lastSentEventId) continue;
      this.dispatchLiveEvent(frame);
    }
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
    if (frame.id) {
      this.lastSentEventId = Math.max(this.lastSentEventId, frame.id);
    }
    const { id, event, data } = frame;
    if (!this.writeDirect(formatSseFrame({ id, event, data }))) {
      this.isBackpressured = true;
    }
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
