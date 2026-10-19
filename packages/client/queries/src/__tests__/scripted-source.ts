import { VIDEO_ID } from '@vp/web-testing';

import type { UserEventSource, UserStreamEvent } from '../user-event-source';

/** An `EventSource` the spec drives: like the browser's, a frame with no `id` repeats the last one. */
export class ScriptedSource implements UserEventSource {
  readonly CLOSED = 2;
  readyState = 1;
  private lastEventId = '';
  private readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? new Set()).add(listener));
  }

  close(): void {
    this.readyState = this.CLOSED;
  }

  send(event: UserStreamEvent, id?: number): void {
    if (id !== undefined) this.lastEventId = String(id);
    this.dispatch(
      new MessageEvent(event.type, { data: JSON.stringify(event), lastEventId: this.lastEventId })
    );
  }

  fail(): void {
    this.readyState = this.CLOSED;
    this.dispatch(new MessageEvent('error'));
  }

  private dispatch(event: MessageEvent<string>): void {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
  }
}

export function progress(overall: number): UserStreamEvent {
  return {
    type: 'video.processing',
    payload: {
      videoId: VIDEO_ID,
      change: { kind: 'progress', rendition: '720p', percent: overall, overall },
    },
  };
}
