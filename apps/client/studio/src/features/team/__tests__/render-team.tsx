import { screen } from '@testing-library/react';
import type { Account } from '@vp/api-contracts';
import { account } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { actOn, serveTeam, type TeamState } from './team-api.fixture';

interface TeamOptions {
  viewer?: Account;
  state?: Partial<TeamState>;
  /** The channel the studio acts on, by its id: the viewer's own unless a membership is named. */
  actingOn?: string;
}

/** `url` in the studio over a team API holding `state`, the viewer signed in and acting on `actingOn`. */
export async function renderTeam(
  url = '/team',
  { viewer = account(), state, actingOn }: TeamOptions = {}
) {
  if (actingOn) actOn(actingOn);
  const served = serveTeam(state);
  const rendered = await renderRoute(getRouter, url, {
    handlers: [signInBrowser(viewer), ...served.handlers],
  });
  await screen.findByRole('heading', { level: 1, name: 'Team' });
  return { ...rendered, ...served };
}
