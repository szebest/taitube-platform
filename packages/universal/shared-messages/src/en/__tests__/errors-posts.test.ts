import { postErrors } from '../errors-posts';

describe('@vp/shared-messages: en post errors', () => {
  it.each(Object.entries(postErrors))(
    'words %s as a placeholder-free sentence',
    (_key, message) => {
      expect(message.template).toMatch(/^[A-Z][^{}]*\.$/);
    }
  );
});
