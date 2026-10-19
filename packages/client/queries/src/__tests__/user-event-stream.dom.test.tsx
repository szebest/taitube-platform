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
  const heard: unknown[] = [];

  function Listener() {
    useUserEvent('video.processing', (event) => heard.push(event));
    return null;
  }

  const tree = (viewer: Session) => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={viewer}>
        <UserEventStream />
        <Listener />
      </SessionProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(tree(session));
  return { queryClient, sources, heard, signOut: () => rerender(tree(GUEST)) };
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
    { resume: 'expired', refetched: true },
    { resume: 'replayed', refetched: false },
    { resume: 'fresh', refetched: false },
  ] as const)(
    'refetches what it shows when the resume is $resume: $refetched',
    ({ resume, refetched }) => {
      const { queryClient, sources } = renderStream();

      sources[0]?.send(hello(resume));

      expect(queryClient.getQueryState(videoKeys.detail(VIDEO_ID))?.isInvalidated).toBe(refetched);
    }
  );

  it('opens nothing for a guest', () => {
    const { sources } = renderStream(GUEST);

    expect(sources).toEqual([]);
  });

  it('closes the stream when the viewer signs out', () => {
    const { sources, signOut } = renderStream();

    signOut();

    expect(sources.map(({ url, readyState }) => [url, readyState])).toEqual([
      ['/api/v1/me/events', 2],
    ]);
  });
});
