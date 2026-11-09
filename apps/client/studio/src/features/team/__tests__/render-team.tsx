import { screen } from '@testing-library/react';
import type { Account } from '@vp/api-contracts';
import type { ErrorCode } from '@vp/errors';
import { account } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import type { HttpHandler } from 'msw/http';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { actOn, forgetActingChannel, serveTeam, type TeamState } from './team-api.fixture';

interface TeamOptions {
  viewer?: Account;
  state?: Partial<TeamState>;
  /** The channel the studio acts on, by its id: the viewer's own unless a membership is named. */
  actingOn?: string;
  inviteFailure?: ErrorCode;
  /** What else the page under test asks the API. */
  handlers?: HttpHandler[];
}

/** `url` in the studio over a team API holding `state`, the viewer signed in and acting on `actingOn`. */
export async function renderTeam(
  url = '/team',
  { viewer = account(), state, actingOn, inviteFailure, handlers = [] }: TeamOptions = {}
) {
  onTestFinished(forgetActingChannel);
  if (actingOn) actOn(actingOn);
  const served = serveTeam(state, inviteFailure);
  const rendered = await renderRoute(getRouter, url, {
    handlers: [signInBrowser(viewer), ...served.handlers, ...handlers],
  });
  await screen.findByRole('navigation', { name: 'Studio' });
  return { ...rendered, ...served };
}
