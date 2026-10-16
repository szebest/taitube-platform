import { getAccount, getChannel, getFeed, getVideo, listMySubscriptions } from '@vp/api-contracts';

import { account, channel, feedPages, subscribedChannel, video, videoSummary } from '../fixtures';

describe('@vp/web-testing: fixtures', () => {
  it.each([
    { fixture: 'video', contract: getVideo, body: video() },
    { fixture: 'channel', contract: getChannel, body: channel() },
    { fixture: 'account', contract: getAccount, body: account() },
    { fixture: 'feedPages', contract: getFeed, body: feedPages([videoSummary()]).pages[0] },
    {
      fixture: 'subscribedChannel',
      contract: listMySubscriptions,
      body: { items: [subscribedChannel()], nextCursor: null },
    },
  ])('builds a $fixture the API contract accepts', ({ contract, body }) => {
    expect(contract.result.safeParse(body).success).toBe(true);
  });
});
