import { onlineManager } from '@tanstack/react-query';

import {
  connectUserEvents,
  type UserEventBrowser,
  type UserStreamEvent,
} from '../user-event-source';
import { progress, ScriptedSource } from './scripted-source';

const STREAM = '/api/v1/me/events';
const HELLO: UserStreamEvent = {
  type: 'hello',
  payload: { resume: 'fresh', unreadNotifications: 0 },
};

function useRetryTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
    onlineManager.setOnline(true);
  });
}

/** Tabs of one browser on the real Web Locks and `BroadcastChannel`, and the sources they open. */
function browserWithTabs(locks: UserEventBrowser['locks'] = navigator.locks) {
  const name = `vp.user-events.${crypto.randomUUID()}`;
  const sources: ScriptedSource[] = [];
  const browser = {
    locks,
    openChannel: (channel: string) => new BroadcastChannel(channel),
    openSource: (url: string) => {
      const source = new ScriptedSource(url);
      sources.push(source);
      return source;
    },
  };

  const openTab = () => {
    const received: UserStreamEvent[] = [];
    const close = connectUserEvents({
      name,
      browser,
      onEvent: (event) => received.push(event),
      onFollow: () => undefined,
    });
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

  it('lets the lock go and opens nothing when the tab closes after the browser granted it the lock', async () => {
    let released = false;
    const grantedAlready: UserEventBrowser['locks'] = {
      request: async (_name, _options, lead) => {
        await Promise.resolve();
        await lead({ name: _name, mode: 'exclusive' });
        released = true;
      },
    };
    const { sources, openTab } = browserWithTabs(grantedAlready);

    openTab().close();

    await vi.waitFor(() => expect(released).toBe(true));
    expect(sources).toEqual([]);
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
    useRetryTimers();
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

  it.each([
    { failure: 'the first failure', before: [], waits: 1_000 },
    { failure: 'a second failure in a row', before: ['fail'], waits: 2_000 },
    { failure: 'a failure once the stream opened again', before: ['fail', 'open'], waits: 1_000 },
    {
      failure: 'the sixth failure in a row',
      before: ['fail', 'fail', 'fail', 'fail', 'fail'],
      waits: 30_000,
    },
  ] as const)('waits $waits ms to reopen after $failure', async ({ before, waits }) => {
    useRetryTimers();
    const { sources, openTab, leading } = browserWithTabs();
    openTab();
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    for (const step of before) {
      if (step === 'open') {
        leading().open();
      } else {
        leading().fail();
        await vi.advanceTimersByTimeAsync(30_000);
      }
    }
    const opened = sources.length;

    leading().fail();
    await vi.advanceTimersByTimeAsync(waits - 1);
    expect(sources).toHaveLength(opened);
    await vi.advanceTimersByTimeAsync(1);

    expect(sources).toHaveLength(opened + 1);
  });
});
