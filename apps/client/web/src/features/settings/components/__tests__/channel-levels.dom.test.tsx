import { screen, waitFor, within } from '@testing-library/react';
import {
  listMySubscriptions,
  type SubscribedChannel,
  updateSubscriptionLevel,
} from '@vp/api-contracts';
import { apiServer, CHANNEL_ID, mockEndpoint, subscribedChannel } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { signInBrowser } from '#app/__tests__/providers';
import { holds, preferencesView } from '#app/features/settings/__tests__/preferences-fixtures';
import { getRouter } from '#app/router';

async function renderChannelLevels(items: SubscribedChannel[]) {
  const sent: unknown[] = [];
  apiServer.use(
    mockEndpoint(listMySubscriptions, () => HttpResponse.json({ items, nextCursor: null })),
    mockEndpoint(updateSubscriptionLevel, async ({ request }) => {
      const body = (await request.json()) as { level: 'none' };
      sent.push(body);
      return HttpResponse.json({ channelId: CHANNEL_ID, level: body.level });
    })
  );
  const rendered = await renderRoute(getRouter, '/settings/notifications', {
    handlers: [signInBrowser(), holds(preferencesView())],
  });
  return { ...rendered, sent };
}

describe('apps/client/web: channel levels', () => {
  it('sets how much a subscribed channel may notify', async () => {
    const { user, sent } = await renderChannelLevels([
      subscribedChannel({ displayName: 'Night Kitchen', notificationLevel: 'highlights' }),
    ]);

    const levels = await screen.findByRole('radiogroup', {
      name: 'Notifications from Night Kitchen',
    });
    expect(within(levels).getByRole('radio', { name: 'Highlights' })).toBeChecked();
    expect(await axeViolations()).toEqual([]);

    await user.click(within(levels).getByRole('radio', { name: 'None' }));

    await waitFor(() => expect(within(levels).getByRole('radio', { name: 'None' })).toBeChecked());
    await waitFor(() => expect(sent).toEqual([{ level: 'none' }]));
  });

  it('has no channels section without a subscription', async () => {
    await renderChannelLevels([]);
    await screen.findByRole('switch', { name: 'Replies and mentions' });

    expect(screen.queryByRole('heading', { name: 'Channels' })).not.toBeInTheDocument();
  });
});
