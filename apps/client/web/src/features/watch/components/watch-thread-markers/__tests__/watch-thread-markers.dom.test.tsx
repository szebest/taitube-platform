import { screen } from '@testing-library/react';
import { renderThreads } from '#app/features/watch/__tests__/render-threads';
import {
  OTHER_THREAD_ID,
  THREAD_ID,
  thread,
  threadList,
} from '#app/features/watch/__tests__/thread-fixtures';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-marker-player')).StubMarkerPlayer,
}));

vi.mock(import('#app/components/player/timeline-marker-layer'), async () => ({
  TimelineMarkerLayer: (await import('#app/__tests__/stub-marker-player')).StubMarkerLayer,
}));

const LIST = threadList(
  [
    thread({ title: 'The twist', anchorMs: 65_000, replyCount: 3 }),
    thread({ id: OTHER_THREAD_ID, title: 'Left sign', anchorMs: 90_000, replyCount: 1 }),
  ],
  [
    { anchorMs: 65_000, threadId: THREAD_ID, threadIds: [THREAD_ID], count: 1 },
    { anchorMs: 90_000, threadId: OTHER_THREAD_ID, threadIds: [OTHER_THREAD_ID], count: 2 },
    { anchorMs: 99_000, threadId: '0190c3a0-5e1d-7000-8000-0000000f1099', threadIds: [], count: 1 },
  ]
);

describe('apps/client/web: WatchThreadMarkers', () => {
  it('hands the layer one marker per server marker, named by the thread it opens', async () => {
    await renderThreads({ list: LIST });

    expect(await screen.findAllByRole('button', { name: /^marker / })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'marker The twist 65000 3 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'marker Left sign 90000 1 2' })).toBeInTheDocument();
  });

  it('draws nothing while the list is still loading or has no markers', async () => {
    await renderThreads({ list: threadList() });

    expect(await screen.findByTestId('marker-slot')).toBeEmptyDOMElement();
  });

  it('opens the thread of an activated marker on the Threads tab', async () => {
    const { user, router } = await renderThreads({ list: LIST });

    await user.click(await screen.findByRole('button', { name: 'marker Left sign 90000 1 2' }));

    expect(router.state.location.search).toMatchObject({
      tab: 'threads',
      thread: OTHER_THREAD_ID,
    });
    expect(
      await screen.findByRole('dialog', { name: 'The twist at the tram' })
    ).toBeInTheDocument();
  });
});
