import { SUBSCRIPTION_TABS, SubscriptionSearchSchema } from '../subscription-search';

describe('apps/client/web: subscription search', () => {
  it.each(SUBSCRIPTION_TABS)('keeps the %s tab', (tab) => {
    expect(SubscriptionSearchSchema.parse({ tab }).tab).toBe(tab);
  });

  it.each([{ tab: 'posts' }, { tab: 3 }, { tab: ['community', 'videos'] }, {}])(
    'leaves the tab out for %j',
    (search) => {
      expect(SubscriptionSearchSchema.parse(search).tab).toBeUndefined();
    }
  );
});
