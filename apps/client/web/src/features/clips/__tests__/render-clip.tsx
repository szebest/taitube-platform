import { screen } from '@testing-library/react';
import { type Account, type ClipView, getClip } from '@vp/api-contracts';
import { CLIP_ID, clip, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

interface ClipOptions {
  clip?: Partial<ClipView>;
  viewer?: Account;
  handlers?: HttpHandler[];
}

/** The clip page of the clip fixture, as a guest or as `viewer`, with the player stood in for. */
export async function renderClip({
  clip: overrides = {},
  viewer,
  handlers = [],
}: ClipOptions = {}) {
  const rendered = await renderRoute(getRouter, `/clip/${CLIP_ID}`, {
    handlers: [
      ...handlers,
      ...(viewer ? [signInBrowser(viewer)] : []),
      mockEndpoint(getClip, () => HttpResponse.json(clip(overrides))),
      ...loaderApi(),
    ],
  });
  await screen.findByTestId('player');
  return rendered;
}
