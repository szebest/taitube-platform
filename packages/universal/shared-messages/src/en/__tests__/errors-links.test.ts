import { linkErrors } from '../errors-links';

describe('@vp/shared-messages: en link errors', () => {
  it.each(Object.entries(linkErrors))(
    'words %s as a placeholder-free sentence',
    (_key, message) => {
      expect(message.template).toMatch(/^[A-Z][^{}]*\.$/);
    }
  );
});
