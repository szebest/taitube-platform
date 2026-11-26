import { channelErrors } from '../errors-channels';

describe('@vp/shared-messages: en channel errors', () => {
  it.each(Object.entries(channelErrors))(
    'words %s as a placeholder-free sentence',
    (_key, message) => {
      expect(message.template).toMatch(/^[A-Z][^{}]*\.$/);
    }
  );
});
