import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { VIDEO_ID, account, video } from '@vp/web-testing';

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
  return { type: 'hello', payload: { resume } };
}

/** One tab that wins the lock at once, its cache holding a processing video, and what it heard. */
function renderStream(session: Session = SIGNED_IN) {
  const sources: ScriptedSource[] = [];
  vi.stubGlobal(
    'EventSource',
    class extends ScriptedSource {
      constructor(url: string) {
        super(url);
        sources.push(this);
      }
    }
  );
  vi.spyOn(navigator.locks, 'request').mockImplementation(
    async (_name: string, _options: LockOptions, grant: LockGrantedCallback<unknown>) => grant(null)
  );
  const queryClient = createQueryClient();
  queryClient.setQueryData(videoKeys.detail(VIDEO_ID), video({ status: 'PROCESSING' }));
  queryClient.setQueryData(NOT_A_VIDEO, []);
  const isInvalidated = (queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated;
  const heard: unknown[] = [];

  function Listener() {
    useUserEvent('video.processing', (event) => heard.push(event));
    return null;
  }

  const tree = (viewer: Session) => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={viewer}>
        <UserEventStream>
          <Listener />
        </UserEventStream>
      </SessionProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(tree(session));
  return { queryClient, sources, heard, isInvalidated, signOut: () => rerender(tree(GUEST)) };
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
    { viewer: 'a signed-in viewer', session: SIGNED_IN, streams: 1, refetched: true },
    { viewer: 'a guest', session: GUEST, streams: 0, refetched: false },
  ])(
    'joins the stream for $viewer and refetches only the videos it shows: $refetched',
    ({ session, streams, refetched }) => {
      const { sources, isInvalidated } = renderStream(session);

      expect(sources).toHaveLength(streams);
      expect(isInvalidated(videoKeys.detail(VIDEO_ID))).toBe(refetched);
      expect(isInvalidated(NOT_A_VIDEO)).toBe(false);
    }
  );

  it.each([
    { resume: 'expired', refetched: true },
    { resume: 'replayed', refetched: false },
    { resume: 'fresh', refetched: false },
  ] as const)(
    'refetches everything it shows when the resume is $resume: $refetched',
    ({ resume, refetched }) => {
      const { sources, isInvalidated } = renderStream();

      sources[0]?.send(hello(resume));

      expect(isInvalidated(NOT_A_VIDEO)).toBe(refetched);
    }
  );

  it('closes the stream when the viewer signs out', () => {
    const { sources, signOut } = renderStream();

    signOut();

    expect(sources.map(({ url, readyState }) => [url, readyState])).toEqual([
      ['/api/v1/me/events', 2],
    ]);
  });
});
