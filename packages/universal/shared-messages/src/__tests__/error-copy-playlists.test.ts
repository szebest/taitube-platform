import { PLAYLIST_ERROR_COPY } from '../error-copy-playlists';
import { translatorFor } from './fixtures';

describe('@vp/shared-messages: PLAYLIST_ERROR_COPY', () => {
  it.each(Object.entries(PLAYLIST_ERROR_COPY))('renders %s as a sentence', (_code, key) => {
    const rendered = translatorFor('en').t(key);

    expect(rendered.ok && rendered.value).toMatch(/^[A-Z].*\.$/);
  });
});
