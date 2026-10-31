import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import {
  CHANNELS,
  type FeedbackCalls,
  FEEDBACK_ID,
  feedbackApi,
  IDS,
} from '#app/features/recommendations/__tests__/recommendation-fixtures';

async function renderHome(options: { putFails?: boolean; signedIn?: boolean } = {}) {
  const calls: FeedbackCalls = { put: [], removed: [] };
  const rendered = await renderRoute(getRouter, '/', {
    handlers: [
      ...feedbackApi(calls, { putFails: options.putFails }),
      ...((options.signedIn ?? true) ? [signInBrowser()] : []),
    ],
  });
  await screen.findByRole('link', { name: 'Lisbon at night' });
  return { ...rendered, calls };
}

const titles = () =>
  screen.queryAllByRole('link', { name: /Lisbon at night|Tram ride|Street food/ });

async function chooseOnFirstCard(
  user: Awaited<ReturnType<typeof renderRoute>>['user'],
  item: 'Not interested' | "Don't recommend this channel"
) {
  await user.click(screen.getAllByRole('button', { name: 'More actions' })[0] as HTMLElement);
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

describe('apps/client/web: the recommendation feedback menu', () => {
  it('takes the card off the shelf at once and says so, with an Undo', async () => {
    const { user, calls } = await renderHome();

    await chooseOnFirstCard(user, 'Not interested');

    expect(await screen.findByText('We will recommend less like this')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Lisbon at night' })).toBeNull();
    expect(calls.put).toEqual([{ kind: 'not_interested', videoId: IDS.night }]);
  });

  it('undoes it from the toast', async () => {
    const { user, calls } = await renderHome();
    await chooseOnFirstCard(user, 'Not interested');

    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    await vi.waitFor(() => expect(calls.removed).toEqual([FEEDBACK_ID]));
  });

  it('hides every video of the channel', async () => {
    const { user, calls } = await renderHome();

    await chooseOnFirstCard(user, "Don't recommend this channel");

    await vi.waitFor(() => expect(titles().map((link) => link.textContent)).toEqual(['Tram ride']));
    expect(calls.put).toEqual([{ kind: 'hide_channel', channelId: CHANNELS.lisbon.id }]);
  });

  it('puts the card back and says so when the write fails', async () => {
    const { user } = await renderHome({ putFails: true });

    await chooseOnFirstCard(user, 'Not interested');

    expect(await screen.findByText('Could not save that. The video is back.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Lisbon at night' })).toBeInTheDocument();
    expect(titles()).toHaveLength(3);
  });

  it('offers a guest no way to give feedback', async () => {
    await renderHome({ signedIn: false });

    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });
});
