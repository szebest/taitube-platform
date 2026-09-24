import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { SSE_PING_COMMENT, type SseMessageEnvelope, formatSseFrame } from '@vp/events';
import { ignore, isOk, tryCatch } from '@vp/result';

export interface SseConnectionOptions {
  channel: string;
  userId?: string;
  rawResponse: ServerResponse;
  heartbeatMs: number;
  idleTimeoutMs: number;
}

export class SseConnection extends EventEmitter {
  readonly channel: string;
  readonly userId?: string;
  private readonly res: ServerResponse;
  private isConnecting = true;
  private isClosed = false;
  private isBackpressured = false;
  private lastSentEventId = 0;
  private readonly connectBuffer: SseMessageEnvelope[] = [];
  private readonly pendingProgress = new Map<string, SseMessageEnvelope>();
  private readonly pendingStatusQueue: SseMessageEnvelope[] = [];
  private heartbeatTimer?: NodeJS.Timeout;
  private idleTimer?: NodeJS.Timeout;

  constructor(options: SseConnectionOptions) {
    super();
    this.channel = options.channel;
    this.userId = options.userId;
    this.res = options.rawResponse;

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

  sendSnapshot(data: Record<string, unknown>, id?: number): void {
    if (this.isClosed) return;
    const effectiveId = id ?? 0;
    this.lastSentEventId = Math.max(this.lastSentEventId, effectiveId);
    const frame = formatSseFrame({
      id: effectiveId > 0 ? effectiveId : undefined,
      event: 'snapshot',
      data,
    });
    this.writeDirect(frame);
  }

  sendReplayEvent(id: number, event: string, data: unknown): void {
    if (this.isClosed) return;
    this.lastSentEventId = Math.max(this.lastSentEventId, id);
    const frame = formatSseFrame({
      id,
      event,
      data,
    });
    this.writeDirect(frame);
  }

  onLiveEvent(envelope: SseMessageEnvelope): void {
    if (this.isClosed) return;

    if (this.isConnecting) {
      this.connectBuffer.push(envelope);
      return;
    }

    if (envelope.id && envelope.id <= this.lastSentEventId) {
      return;
    }

    this.dispatchLiveEvent(envelope);
  }

  markLive(lastSentId?: number): void {
    if (this.isClosed) return;
    if (lastSentId !== undefined) {
      this.lastSentEventId = Math.max(this.lastSentEventId, lastSentId);
    }
    this.isConnecting = false;

    while (this.connectBuffer.length > 0) {
      const ev = this.connectBuffer.shift();
      if (!ev) {
        break;
      }
      if (ev.id && ev.id <= this.lastSentEventId) {
        continue;
      }
      this.dispatchLiveEvent(ev);
    }
  }

  private dispatchLiveEvent(envelope: SseMessageEnvelope): void {
    if (this.isBackpressured) {
      if (envelope.event === 'progress') {
        const key = (envelope.data['rendition'] as string) || 'overall';
        this.pendingProgress.set(key, envelope);
      } else {
        this.pendingStatusQueue.push(envelope);
      }
      return;
    }

    if (envelope.id) {
      this.lastSentEventId = Math.max(this.lastSentEventId, envelope.id);
    }

    const frame = formatSseFrame({
      id: envelope.id,
      event: envelope.event,
      data: envelope.data,
    });

    const canWrite = this.writeDirect(frame);
    if (!canWrite) {
      this.isBackpressured = true;
    }
  }

  private handleDrain(): void {
    this.isBackpressured = false;

    for (const progressEv of this.pendingProgress.values()) {
      if (progressEv.id) {
        this.lastSentEventId = Math.max(this.lastSentEventId, progressEv.id);
      }
      const frame = formatSseFrame({
        id: progressEv.id,
        event: progressEv.event,
        data: progressEv.data,
      });
      if (!this.writeDirect(frame)) {
        this.isBackpressured = true;
      }
    }
    this.pendingProgress.clear();

    while (this.pendingStatusQueue.length > 0 && !this.isBackpressured) {
      const statusEv = this.pendingStatusQueue.shift();
      if (!statusEv) {
        break;
      }
      if (statusEv.id) {
        this.lastSentEventId = Math.max(this.lastSentEventId, statusEv.id);
      }
      const frame = formatSseFrame({
        id: statusEv.id,
        event: statusEv.event,
        data: statusEv.data,
      });
      if (!this.writeDirect(frame)) {
        this.isBackpressured = true;
      }
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
