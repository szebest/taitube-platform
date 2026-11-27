import { POST_ERROR_COPY } from '../error-copy-posts';
import { translatorFor } from './fixtures';

describe('@vp/shared-messages: POST_ERROR_COPY', () => {
  it.each(Object.entries(POST_ERROR_COPY))('renders %s as a sentence', (_code, key) => {
    const rendered = translatorFor('en').t(key);

    expect(rendered.ok && rendered.value).toMatch(/^[A-Z].*\.$/);
  });
});
