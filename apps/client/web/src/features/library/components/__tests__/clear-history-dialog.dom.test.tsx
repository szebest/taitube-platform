import { screen, within } from '@testing-library/react';
import { clearSearchHistory, clearWatchHistory } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { historyItem, searchItem } from '../../__tests__/library-fixtures';
import { renderLibrary, useLibraryClock } from '../../__tests__/render-library';

const SCOPES = [
  {
    scope: 'history',
    url: '/feed/history',
    button: 'Clear all watch history',
    title: 'Clear your watch history?',
    contract: clearWatchHistory,
    call: 'DELETE /v1/me/history',
    empty: 'Nothing watched yet',
    kept: 'Video 1',
  },
  {
    scope: 'searches',
    url: '/feed/history?tab=searches',
    button: 'Clear all searches',
    title: 'Clear your searches?',
    contract: clearSearchHistory,
    call: 'DELETE /v1/me/searches',
    empty: 'No searches yet',
    kept: 'tram',
  },
] as const;

const rows = { history: [historyItem(1)], searches: [searchItem(1, 'tram')] };

describe('apps/client/web: ClearHistoryDialog', () => {
  useLibraryClock();

  describe.each(SCOPES)('for the $scope', (scope) => {
    const open = async (calls: string[], handlers: HttpHandler[] = []) => {
      const rendered = await renderLibrary(scope.url, { ...rows, calls, handlers });
      await rendered.user.click(await screen.findByRole('button', { name: scope.button }));
      return { ...rendered, dialog: await screen.findByRole('dialog', { name: scope.title }) };
    };

    it('is a URL modal that clears nothing until confirmed, and nothing when cancelled', async () => {
      const calls: string[] = [];
      const { user, router, dialog } = await open(calls);

      expect(router.state.location.search).toMatchObject({
        modal: 'clear-history',
        scope: scope.scope,
      });
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(calls).not.toContain(scope.call);
      expect(screen.getByText(scope.kept)).toBeInTheDocument();
    });

    it('empties the list at once when confirmed', async () => {
      const held = heldReply(() => new HttpResponse<null>(null, { status: 204 }));
      const calls: string[] = [];
      const { user, dialog } = await open(calls, [mockEndpoint(scope.contract, held.answer)]);

      await user.click(within(dialog).getByRole('button', { name: scope.button }));

      expect(await screen.findByText(scope.empty)).toBeInTheDocument();
      held.release();
    });

    it('brings the list back and says so when the server refuses', async () => {
      const { user, dialog } = await open(
        [],
        [mockEndpoint(scope.contract, () => problemReply(ErrorCodes.INTERNAL))]
      );

      await user.click(within(dialog).getByRole('button', { name: scope.button }));

      expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
      expect(await screen.findByText(scope.kept)).toBeInTheDocument();
    });
  });
});
