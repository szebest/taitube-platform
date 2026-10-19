import { onlineManager } from '@tanstack/react-query';
import { VIDEO_ID } from '@vp/web-testing';

import {
  connectUserEvents,
  type UserEventSource,
  type UserStreamEvent,
} from '../user-event-source';

const STREAM = '/api/v1/me/events';
const HELLO: UserStreamEvent = { type: 'hello', payload: { resume: 'fresh' } };

/** An `EventSource` the spec drives: like the browser's, a frame with no `id` repeats the last one. */
class ScriptedSource implements UserEventSource {
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

function progress(overall: number): UserStreamEvent {
  return {
    type: 'video.processing',
    payload: {
      videoId: VIDEO_ID,
      change: { kind: 'progress', rendition: '720p', percent: overall, overall },
    },
  };
}

/** Tabs of one browser on the real Web Locks and `BroadcastChannel`, and the sources they open. */
function browserWithTabs() {
  const name = `vp.user-events.${crypto.randomUUID()}`;
  const sources: ScriptedSource[] = [];
  const browser = {
    locks: navigator.locks,
    openChannel: (channel: string) => new BroadcastChannel(channel),
    openSource: (url: string) => {
      const source = new ScriptedSource(url);
      sources.push(source);
      return source;
    },
  };

  const openTab = () => {
    const received: UserStreamEvent[] = [];
    const close = connectUserEvents({ name, browser, onEvent: (event) => received.push(event) });
    onTestFinished(close);
    return { received, close };
  };
  const leading = () => {
    const source = sources.at(-1);
    if (!source) throw new Error('no tab opened the stream');
    return source;
  };
  const urls = () => sources.map(({ url, readyState }) => ({ url, closed: readyState === 2 }));

  return { sources, openTab, leading, urls };
}

describe('@vp/queries: user event source', () => {
  it('opens one connection for every tab and hands each tab every event, a tick with no id too', async () => {
    const { sources, openTab, leading } = browserWithTabs();
    const tabs = [openTab(), openTab(), openTab()];
    await vi.waitFor(() => expect(sources).toHaveLength(1));

    leading().send(HELLO);
    leading().send(progress(10), 1);
    leading().send(progress(20));

    await vi.waitFor(() => {
      for (const { received } of tabs) {
        expect(received).toEqual([HELLO, progress(10), progress(20)]);
      }
    });
    expect(sources.map(({ url }) => url)).toEqual([STREAM]);
  });

  it('moves the stream to the next tab when the leading one closes, from the last id the tabs saw', async () => {
    const { sources, openTab, leading, urls } = browserWithTabs();
    const first = openTab();
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    const second = openTab();
    leading().send(progress(10), 1);
    leading().send(progress(20), 2);
    await vi.waitFor(() => expect(second.received).toHaveLength(2));

    first.close();
    await vi.waitFor(() => expect(sources).toHaveLength(2));
    leading().send(progress(20), 2);
    leading().send(progress(30), 3);

    expect(urls()).toEqual([
      { url: STREAM, closed: true },
      { url: `${STREAM}?last-event-id=2`, closed: false },
    ]);
    expect(second.received).toEqual([progress(10), progress(20), progress(30)]);
  });

  it.each([
    {
      cut: 'the connection fails',
      interrupt: (source: ScriptedSource) => source.fail(),
      restore: () => vi.advanceTimersByTimeAsync(1_000),
    },
    {
      cut: 'the browser goes offline',
      interrupt: () => onlineManager.setOnline(false),
      restore: async () => onlineManager.setOnline(true),
    },
  ])('reopens from the last id it saw after $cut', async ({ interrupt, restore }) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    onTestFinished(() => {
      vi.useRealTimers();
      onlineManager.setOnline(true);
    });
    const { sources, openTab, leading, urls } = browserWithTabs();
    openTab();
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    leading().send(progress(10), 7);

    interrupt(leading());
    expect(sources).toHaveLength(1);
    await restore();

    expect(urls()).toEqual([
      { url: STREAM, closed: true },
      { url: `${STREAM}?last-event-id=7`, closed: false },
    ]);
  });
});
