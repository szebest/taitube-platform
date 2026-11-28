import { CHANNEL_LAYOUT_TEMPLATES, channelLayoutTemplate } from '@vp/domain';
import { ChannelLayoutSchema } from '../channel-layout';

describe('@vp/api-contracts: channel layout templates', () => {
  it.each(CHANNEL_LAYOUT_TEMPLATES)('parses the %s template through the schema', (template) => {
    expect(ChannelLayoutSchema.safeParse(channelLayoutTemplate(template)).success).toBe(true);
  });
});
