import { videoToolErrors } from '../errors-video-tools';

describe('@vp/messages: en video tool errors', () => {
  it.each(Object.entries(videoToolErrors))(
    'words %s as a placeholder-free sentence',
    (_key, message) => {
      expect(message.template).toMatch(/^[A-Z][^{}]*\.$/);
    }
  );
});
