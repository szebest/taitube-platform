import { layoutErrors } from '../errors-layout';

describe('@vp/shared-messages: en layout errors', () => {
  it.each(Object.entries(layoutErrors))(
    'words %s as a placeholder-free sentence',
    (_key, message) => {
      expect(message.template).toMatch(/^[A-Z][^{}]*\.$/);
    }
  );
});
