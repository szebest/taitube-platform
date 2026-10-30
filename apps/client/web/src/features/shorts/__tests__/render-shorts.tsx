import { screen } from '@testing-library/react';
import {
  type Account,
  getMyReaction,
  getShorts,
  getVideo,
  type VideoSummary,
} from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

import { SHORTS } from './short-fixtures';

interface ShortsOptions {
  shorts?: VideoSummary[];
  path?: string;
  viewer?: Account;
  handlers?: HttpHandler[];
}

/** The Shorts player of a feed, as a guest or as `viewer`, with the player stood in for and `path` opened. */
export async function renderShorts({
  shorts = SHORTS,
  path = '/shorts',
  viewer,
  handlers = [],
}: ShortsOptions = {}) {
  const viewerApi = viewer
    ? [
        signInBrowser(viewer),
        mockEndpoint(getMyReaction, ({ params }) =>
          HttpResponse.json({ videoId: String(params.id), reaction: null })
        ),
      ]
    : [];

  const rendered = await renderRoute(getRouter, path, {
    handlers: [
      ...handlers,
      ...viewerApi,
      mockEndpoint(getShorts, () =>
        HttpResponse.json({ items: shorts, nextCursor: null, total: shorts.length })
      ),
      mockEndpoint(getVideo, ({ params }) =>
        HttpResponse.json(
          video({ id: String(params.id ?? VIDEO_ID), title: 'Linked Short', format: 'short' })
        )
      ),
      ...loaderApi(),
    ],
  });
  await screen.findByRole(shorts.length > 0 ? 'region' : 'heading', { name: /Shorts/ });
  return rendered;
}
