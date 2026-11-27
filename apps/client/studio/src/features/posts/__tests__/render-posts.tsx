import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createActingChannelStore } from '@vp/queries';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { type PostsState, servePosts, TEAM_CHANNEL_ID } from './posts-api.fixture';

/** `url` in the studio over a posting API holding `state`, signed in, on the team channel when `state.role` names a role there. */
export async function renderPosts(
  url = '/posts',
  state: Partial<PostsState> = {},
  more: Parameters<typeof renderRoute>[2] extends { handlers?: infer H } | undefined
    ? H
    : never = []
) {
  const actingChannel = createActingChannelStore();
  onTestFinished(() => actingChannel.select(undefined));
  if (state.role) actingChannel.select(TEAM_CHANNEL_ID);
  const served = servePosts(state);
  const rendered = await renderRoute(getRouter, url, {
    handlers: [signInBrowser(), ...more, ...served.handlers],
  });
  await screen.findByRole('heading', { level: 1, name: 'Posts' });
  return { ...rendered, ...served, user: userEvent.setup() };
}
