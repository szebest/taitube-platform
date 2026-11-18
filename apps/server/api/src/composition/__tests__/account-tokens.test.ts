import { AccountServices } from '../account-tokens';
import { Services } from '../service-tokens';

describe('apps/server/api/composition: account tokens', () => {
  it.each(Object.entries(AccountServices))(
    '%s is the very token Services holds, so a provider registered on one resolves through the other',
    (name, held) => {
      expect(Services[name as keyof typeof AccountServices]).toBe(held);
    }
  );
});
