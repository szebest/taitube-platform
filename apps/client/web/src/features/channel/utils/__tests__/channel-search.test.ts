import { CHANNEL_TABS, ChannelSearchSchema } from '../channel-search';

describe('apps/client/web: channel search', () => {
  it.each(CHANNEL_TABS)('keeps the %s tab', (tab) => {
    expect(ChannelSearchSchema.parse({ tab }).tab).toBe(tab);
  });

  it.each([{ tab: 'videos' }, { tab: 3 }, { tab: ['posts', 'home'] }, {}])(
    'leaves the tab out for %j',
    (search) => {
      expect(ChannelSearchSchema.parse(search).tab).toBeUndefined();
    }
  );
});
