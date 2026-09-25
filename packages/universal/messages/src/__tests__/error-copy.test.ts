import { ERROR_COPY } from '../error-copy';
import { translatorFor } from './fixtures';

describe('@vp/messages: ERROR_COPY', () => {
  it.each(Object.entries(ERROR_COPY))('renders %s as a sentence', (_code, key) => {
    const rendered = translatorFor('en').t(key);

    expect(rendered.ok && rendered.value).toMatch(/^[A-Z].*\.$/);
  });
});
