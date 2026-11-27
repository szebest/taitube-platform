import { LINK_ERROR_COPY } from '../error-copy-links';
import { translatorFor } from './fixtures';

describe('@vp/shared-messages: LINK_ERROR_COPY', () => {
  it.each(Object.entries(LINK_ERROR_COPY))('renders %s as a sentence', (_code, key) => {
    const rendered = translatorFor('en').t(key);

    expect(rendered.ok && rendered.value).toMatch(/^[A-Z].*\.$/);
  });
});
