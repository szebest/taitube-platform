import { LAYOUT_ERROR_COPY } from '../error-copy-layout';
import { translatorFor } from './fixtures';

describe('@vp/shared-messages: LAYOUT_ERROR_COPY', () => {
  it.each(Object.entries(LAYOUT_ERROR_COPY))('renders %s as a sentence', (_code, key) => {
    const rendered = translatorFor('en').t(key);

    expect(rendered.ok && rendered.value).toMatch(/^[A-Z].*\.$/);
  });
});
