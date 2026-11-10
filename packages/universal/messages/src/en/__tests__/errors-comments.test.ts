import { commentErrors } from '../errors-comments';

describe('@vp/messages: en comment errors', () => {
  it.each(Object.entries(commentErrors))(
    'words %s as a placeholder-free sentence',
    (_key, message) => {
      expect(message.template).toMatch(/^[A-Z][^{}]*\.$/);
    }
  );
});
