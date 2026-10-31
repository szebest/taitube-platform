import { screen, waitFor, within } from '@testing-library/react';
import { removeWatchHistoryEntry } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { historyItem, uuid } from '#app/features/library/__tests__/library-fixtures';
import { renderLibrary, useLibraryClock } from '#app/features/library/__tests__/render-library';

const HISTORY = [historyItem(1, { title: 'Tram ride' }), historyItem(2, { title: 'Old film' })];

const rowOf = async (title: string) => {
  const card = (await screen.findByRole('link', { name: title })).closest('article');
  if (!card) throw new Error(`no card around ${title}`);
  return within(card);
};

const removeFromHistory = async (
  user: Awaited<ReturnType<typeof renderLibrary>>['user'],
  title: string
) => {
  await user.click((await rowOf(title)).getByRole('button', { name: 'More actions' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Remove from watch history' }));
};

describe('apps/client/web: HistoryVideoRow', () => {
  useLibraryClock();

  it.each([
    { scenario: 'a partly watched video', override: {}, href: `/watch/${uuid(1)}?t=100` },
    {
      scenario: 'a completed video',
      override: { completed: true, progressPercent: 100, resumeAtSeconds: 0 },
      href: `/watch/${uuid(1)}`,
    },
    {
      scenario: 'a video barely started',
      override: { progressPercent: 0, resumeAtSeconds: 0 },
      href: `/watch/${uuid(1)}`,
    },
  ])('links $scenario to the watch page at its resume point', async ({ override, href }) => {
    await renderLibrary('/feed/history', { history: [historyItem(1, override)] });

    expect(await screen.findByRole('link', { name: 'Video 1' })).toHaveAttribute('href', href);
  });

  it.each([
    { progressPercent: 50, bar: true },
    { progressPercent: 0, bar: false },
  ])('shows the resume bar only for a video watched $progressPercent %', async (override) => {
    await renderLibrary('/feed/history', {
      history: [historyItem(1, { progressPercent: override.progressPercent })],
    });

    const row = await rowOf('Video 1');

    expect(row.queryByRole('progressbar') !== null).toBe(override.bar);
  });

  it('takes the video off the list before the server answers', async () => {
    const held = heldReply(() => new HttpResponse<null>(null, { status: 204 }));
    const calls: string[] = [];
    const { user } = await renderLibrary('/feed/history', {
      history: HISTORY,
      calls,
      handlers: [mockEndpoint(removeWatchHistoryEntry, held.answer)],
    });

    await removeFromHistory(user, 'Tram ride');

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Tram ride' })).toBeNull());
    expect(screen.getByRole('link', { name: 'Old film' })).toBeInTheDocument();
    held.release();
  });

  it('puts the video back and says so when the server refuses', async () => {
    const { user } = await renderLibrary('/feed/history', {
      history: HISTORY,
      handlers: [mockEndpoint(removeWatchHistoryEntry, () => problemReply(ErrorCodes.INTERNAL))],
    });

    await removeFromHistory(user, 'Tram ride');

    expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Tram ride' })).toBeInTheDocument();
  });
});
