import { playlistErrors } from '../errors-playlists';

describe('@vp/shared-messages: en playlist errors', () => {
  it.each(Object.entries(playlistErrors))(
    'words %s as a placeholder-free sentence',
    (_key, message) => {
      expect(message.template).toMatch(/^[A-Z][^{}]*\.$/);
    }
  );
});
