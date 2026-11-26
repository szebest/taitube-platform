import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { VIDEO_ID, account, video } from '@vp/web-testing';
import type { Identity } from '../account-slots';
import { createQueryClient } from '../create-query-client';
import { GUEST, type Session } from '../session';
import { SessionProvider } from '../session-provider';
import type { UserStreamEvent } from '../user-event-source';
import { UserEventStream, useUserEvent } from '../user-event-stream';
import { videoKeys } from '../video-queries';
import { ScriptedSource, progress } from './scripted-source';

const SIGNED_IN: Session = { status: 'signed-in', account: account() };
const NOT_A_VIDEO = ['categories'];

function hello(resume: 'fresh' | 'replayed' | 'expired'): UserStreamEvent {
  return { type: 'hello', payload: { resume, unreadNotifications: 7 } };
}

/** One tab that wins the lock at once, its cache holding a processing video, and what it heard. */
type LockGrant = (
  name: string,
  options: LockOptions,
  grant: LockGrantedCallback<unknown>
) => unknown;

const freeLock: LockGrant = (name, _options, grant) => grant({ name, mode: 'exclusive' });
const heldByAnotherTab: LockGrant = (_name, { ifAvailable }, grant) =>
  ifAvailable ? grant(null) : new Promise(() => undefined);

function processingCache() {
  const queryClient = createQueryClient();
  queryClient.setQueryData(videoKeys.detail(VIDEO_ID), video({ status: 'PROCESSING' }));
  queryClient.setQueryData(NOT_A_VIDEO, []);
  return queryClient;
}

function renderStream(session: Session = SIGNED_IN, lock: LockGrant = freeLock) {
  const sources: ScriptedSource[] = [];
  const timeline: string[] = [];
  vi.stubGlobal(
    'EventSource',
    class extends ScriptedSource {
      constructor(url: string) {
        super(url);
        timeline.push(`open ${url}`);
        sources.push(this);
      }

      override close(): void {
        timeline.push(`close ${this.url}`);
        super.close();
      }
    }
  );
  const locks = vi
    .spyOn(navigator.locks, 'request')
    .mockImplementation(async (name, options, grant) => lock(name, options, grant));
  const queryClient = processingCache();
  const isInvalidated = (queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated;
  const heard: unknown[] = [];

  function Listener() {
    useUserEvent('video.processing', (event) => heard.push(event));
    return null;
  }

  const tree = (viewer: Session, identity: Identity = { slot: 0 }, client = queryClient) => (
    <QueryClientProvider client={client}>
      <SessionProvider session={viewer} identity={identity}>
        <UserEventStream>
          <Listener />
        </UserEventStream>
      </SessionProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(tree(session));
  return {
    queryClient,
    sources,
    heard,
    timeline,
    isInvalidated,
    lockNames: () => locks.mock.calls.map(([name]) => name),
    signOut: () => rerender(tree(GUEST)),
    switchTo: (identity: Identity, client: QueryClient) =>
      rerender(tree(session, identity, client)),
  };
}

describe('@vp/queries: UserEventStream', () => {
  it("feeds the signed-in viewer's events into the query cache and to useUserEvent", () => {
    const { queryClient, sources, heard } = renderStream();

    sources[0]?.send(progress(40), 1);

    expect(queryClient.getQueryData(videoKeys.detail(VIDEO_ID))).toMatchObject({
      progress: { overall: 40 },
    });
    expect(heard).toEqual([progress(40)]);
  });

  it.each([
    {
      viewer: 'a signed-in viewer',
      session: SIGNED_IN,
      lock: freeLock,
      streams: 1,
      refetched: false,
    },
    {
      viewer: 'a signed-in viewer behind a leading tab',
      session: SIGNED_IN,
      lock: heldByAnotherTab,
      streams: 0,
      refetched: true,
    },
    { viewer: 'a guest', session: GUEST, lock: freeLock, streams: 0, refetched: false },
  ])(
    'joins the stream for $viewer: $streams opened, the videos refetched: $refetched',
    ({ session, lock, streams, refetched }) => {
      const { sources, isInvalidated } = renderStream(session, lock);

      expect(sources).toHaveLength(streams);
      expect(isInvalidated(videoKeys.detail(VIDEO_ID))).toBe(refetched);
    }
  );

  it.each([
    { resume: 'fresh', videos: true, everything: false },
    { resume: 'replayed', videos: false, everything: false },
    { resume: 'expired', videos: true, everything: true },
  ] as const)(
    'refetches on a $resume resume, the videos: $videos, everything: $everything',
    ({ resume, videos, everything }) => {
      const { sources, isInvalidated } = renderStream();

      sources[0]?.send(hello(resume));

      expect(isInvalidated(videoKeys.detail(VIDEO_ID))).toBe(videos);
      expect(isInvalidated(NOT_A_VIDEO)).toBe(everything);
    }
  );

  it('sets the unread notification count from hello', () => {
    const { queryClient, sources } = renderStream();

    sources[0]?.send(hello('fresh'));

    expect(queryClient.getQueryData(['notifications', 'unread-count'])).toEqual({
      unreadCount: 7,
    });
  });

  it('closes the stream when the viewer signs out', () => {
    const { sources, signOut } = renderStream();

    signOut();

    expect(sources.map(({ url, readyState }) => [url, readyState])).toEqual([
      ['/u/0/api/v1/me/events', 2],
    ]);
  });

  it("closes the last identity's stream before it opens the next, and keeps the last identity's events out", async () => {
    const { sources, heard, timeline, lockNames, switchTo } = renderStream();
    sources[0]?.send(progress(10), 1);
    const nextCache = processingCache();
    const lastIdentityName = `vp.user-events.0.primary.${account().id}`;
    const lastIdentity = new BroadcastChannel(lastIdentityName);
    const anotherTabOnIt = new BroadcastChannel(lastIdentityName);
    const reachedAnotherTab = vi.fn();
    anotherTabOnIt.addEventListener('message', reachedAnotherTab);
    onTestFinished(() => {
      lastIdentity.close();
      anotherTabOnIt.close();
    });

    switchTo({ slot: 1, channel: 'second' }, nextCache);
    lastIdentity.postMessage({ id: 2, event: progress(90) });
    await vi.waitFor(() => expect(reachedAnotherTab).toHaveBeenCalledOnce());

    expect(timeline).toEqual([
      'open /u/0/api/v1/me/events',
      'close /u/0/api/v1/me/events',
      'open /u/1/api/v1/me/events',
    ]);
    expect(new Set(lockNames())).toEqual(
      new Set([
        `vp.user-events.0.primary.${account().id}`,
        `vp.user-events.1.second.${account().id}`,
      ])
    );
    expect(nextCache.getQueryData(videoKeys.detail(VIDEO_ID))).toEqual(
      video({ status: 'PROCESSING' })
    );
    expect(heard).toEqual([progress(10)]);
  });
});
