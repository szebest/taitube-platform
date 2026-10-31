import { screen, waitFor } from '@testing-library/react';
import { removeSearchHistoryEntry } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { RecordingObserver } from '#app/features/watch/__tests__/recording-observer';

import { searchItem, uuid } from '../../__tests__/library-fixtures';
import { renderLibrary, useLibraryClock } from '../../__tests__/render-library';

const SEARCHES = [searchItem(1, 'tram'), searchItem(2, 'lisbon'), searchItem(3, 'metro')];

const URL = '/feed/history?tab=searches';

describe('apps/client/web: SearchHistoryList', () => {
  useLibraryClock();

  it('lists the searches, each searching again', async () => {
    await renderLibrary(URL, { searches: SEARCHES });

    expect(await screen.findByRole('link', { name: 'lisbon' })).toHaveAttribute(
      'href',
      '/search?q=lisbon'
    );
  });

  it('shows one line when nothing was searched', async () => {
    await renderLibrary(URL);

    expect(await screen.findByText('No searches yet')).toBeInTheDocument();
  });

  describe('paging by keyset', () => {
    beforeEach(() => RecordingObserver.install());
    afterEach(() => vi.unstubAllGlobals());

    it('asks for the next page with the cursor once the end is near', async () => {
      const calls: string[] = [];
      await renderLibrary(URL, { searches: SEARCHES, pageSize: 2, calls });
      await screen.findByRole('link', { name: 'tram' });
      expect(screen.queryByRole('link', { name: 'metro' })).toBeNull();

      RecordingObserver.enterView();

      expect(await screen.findByRole('link', { name: 'metro' })).toBeInTheDocument();
    });
  });

  describe('removing one search', () => {
    it('drops it before the server answers', async () => {
      const held = heldReply(() => new HttpResponse<null>(null, { status: 204 }));
      const removed: string[] = [];
      const { user } = await renderLibrary(URL, {
        searches: SEARCHES,
        handlers: [
          mockEndpoint(removeSearchHistoryEntry, (info) => {
            removed.push(String(info.params.id));
            return held.answer();
          }),
        ],
      });

      await user.click(await screen.findByRole('button', { name: 'Remove search lisbon' }));

      await waitFor(() => expect(screen.queryByRole('link', { name: 'lisbon' })).toBeNull());
      expect(screen.getByRole('link', { name: 'tram' })).toBeInTheDocument();
      held.release();
      await waitFor(() => expect(removed).toEqual([uuid(2002)]));
    });

    it('puts it back and says so when the server refuses', async () => {
      const { user } = await renderLibrary(URL, {
        searches: SEARCHES,
        handlers: [mockEndpoint(removeSearchHistoryEntry, () => problemReply(ErrorCodes.INTERNAL))],
      });

      await user.click(await screen.findByRole('button', { name: 'Remove search lisbon' }));

      expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: 'lisbon' })).toBeInTheDocument();
    });
  });
});
