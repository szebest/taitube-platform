import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createActingChannelStore } from '@vp/queries';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { type DevelopersState, serveDevelopers, TEAM_CHANNEL_ID } from './developers-api.fixture';

/** `/developers` in the studio over an API holding `state`, signed in, on the team channel when `state.role` names a role there. */
export async function renderDevelopers(state: Partial<DevelopersState> = {}) {
  const actingChannel = createActingChannelStore();
  onTestFinished(() => actingChannel.select(undefined));
  if (state.role) actingChannel.select(TEAM_CHANNEL_ID);
  const served = serveDevelopers(state);
  const rendered = await renderRoute(getRouter, '/developers', {
    handlers: [signInBrowser(), ...served.handlers],
  });
  await screen.findByRole('heading', { level: 1, name: 'Developers' });
  return { ...rendered, ...served, user: userEvent.setup() };
}
