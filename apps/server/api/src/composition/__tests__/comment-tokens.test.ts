import { CommentServices } from '../comment-tokens';
import { Services } from '../service-tokens';

describe('apps/server/api/composition: comment tokens', () => {
  it.each(Object.entries(CommentServices))(
    '%s is the very token Services holds, so a provider registered on one resolves through the other',
    (name, token) => {
      expect(Services[name as keyof typeof Services]).toBe(token);
    }
  );
});
