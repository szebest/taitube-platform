import { screen, within } from '@testing-library/react';
import {
  createWatchParty,
  getCurrentPick,
  getHome,
  getShorts,
  listLiveStreams,
  listMyPlaylists,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, partyRoom, problemReply, videoSummary } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

/** The signed-in home page with one card, whose menu the spec opens; `handlers` answer for the viewer's parties. */
export async function renderMenuCard(handlers: HttpHandler[]) {
  const rendered = await renderRoute(getRouter, '/', {
    handlers: [
      signInBrowser(),
      ...handlers,
      mockEndpoint(getHome, () =>
        HttpResponse.json({
          shelves: [
            {
              kind: 'trending',
              items: [
                { ...videoSummary({ title: 'Launch day' }), reason: { kind: 'shared-tags' } },
              ],
            },
          ],
        })
      ),
      mockEndpoint(getCurrentPick, () => problemReply(ErrorCodes.VIDEO_NOT_FOUND)),
      mockEndpoint(getShorts, () => HttpResponse.json({ items: [], nextCursor: null, total: 0 })),
      mockEndpoint(listLiveStreams, () => HttpResponse.json({ items: [] })),
      mockEndpoint(listMyPlaylists, () => HttpResponse.json({ items: [] })),
      mockEndpoint(createWatchParty, () => HttpResponse.json(partyRoom(), { status: 201 })),
    ],
  });
  const card = within(await screen.findByRole('article'));
  const openMenu = async () =>
    rendered.user.click(await card.findByRole('button', { name: 'More actions' }));
  return { ...rendered, openMenu };
}
