import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { account, VIDEO_ID, videoSummary } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentType, PropsWithChildren } from 'react';

import { signedIn } from '#app/__tests__/providers';
import { type CreatorVideo, LibraryVideoRow } from '../library-video-row';

const STRANGER_ID = '0190c3a0-5e1d-7000-8000-00000000b009';

const creator = signedIn();
const stranger = signedIn(
  account({ id: STRANGER_ID, role: 'USER', user: { ...account().user, id: STRANGER_ID } })
);

const creatorVideo = (overrides: Partial<CreatorVideo> = {}): CreatorVideo => ({
  ...videoSummary({
    title: 'Lisbon at night',
    durationMs: 765_000,
    viewsCount: 1_200_000,
    thumbnailUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  }),
  commentsCount: 4,
  tags: ['night'],
  ...overrides,
});

async function renderRow(
  video: CreatorVideo = creatorVideo(),
  Providers: ComponentType<PropsWithChildren> = creator
) {
  const onInspect = vi.fn();
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <Providers>
          <main>
            <LibraryVideoRow video={video} onInspect={onInspect} />
          </main>
        </Providers>
      ),
    }),
    history: createMemoryHistory(),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return { onInspect, user: userEvent.setup() };
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Actions for Lisbon at night' }));

describe('apps/client/studio: LibraryVideoRow', () => {
  it('draws the frame with its duration, then the status, visibility and formatted numbers', async () => {
    await renderRow();

    expect(screen.getByText('12:45')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('1.2M views')).toBeInTheDocument();
  });

  it.each([
    { status: 'PROCESSING', label: 'Processing' },
    { status: 'FAILED', label: 'Failed' },
    { status: 'REJECTED', label: 'Rejected' },
  ] as const)('names a $status video $label', async ({ status, label }) => {
    await renderRow(creatorVideo({ status }));

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('falls back to the untitled line for a video without a title', async () => {
    await renderRow(creatorVideo({ title: null }));

    expect(screen.getByRole('button', { name: 'Untitled video' })).toBeInTheDocument();
  });

  it('opens the inspector for its video from the title', async () => {
    const { onInspect, user } = await renderRow();

    await user.click(screen.getByRole('button', { name: 'Lisbon at night' }));

    expect(onInspect).toHaveBeenCalledWith(VIDEO_ID);
  });

  it.each([
    {
      viewer: 'the creator, on a public ready video',
      Providers: creator,
      video: creatorVideo(),
      shown: ['Edit', 'Analytics', 'Watch on Taitube'],
    },
    {
      viewer: 'the creator, on a private video',
      Providers: creator,
      video: creatorVideo({ visibility: 'private' }),
      shown: ['Edit', 'Analytics'],
    },
    {
      viewer: 'someone else',
      Providers: stranger,
      video: creatorVideo(),
      shown: ['Watch on Taitube'],
    },
  ])('offers $viewer only the actions they may take', async ({ Providers, video, shown }) => {
    const { user } = await renderRow(video, Providers);

    await openMenu(user);

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(shown);
  });

  it('passes axe', async () => {
    await renderRow();

    expect(await axeViolations()).toEqual([]);
  });
});
