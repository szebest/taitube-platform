import { CHANNEL_ERROR_COPY } from '../error-copy-channels';
import { translatorFor } from './fixtures';

describe('@vp/shared-messages: CHANNEL_ERROR_COPY', () => {
  it.each(Object.entries(CHANNEL_ERROR_COPY))('renders %s as a sentence', (_code, key) => {
    const rendered = translatorFor('en').t(key);

    expect(rendered.ok && rendered.value).toMatch(/^[A-Z].*\.$/);
  });
});
