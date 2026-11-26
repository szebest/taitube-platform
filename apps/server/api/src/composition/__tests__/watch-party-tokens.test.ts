import { Services } from '../service-tokens';
import { WatchPartyServices } from '../watch-party-tokens';

describe('apps/server/api/composition: watch party tokens', () => {
  it.each(Object.entries(WatchPartyServices))(
    '%s is the very token Services holds, so a provider registered on one resolves through the other',
    (name, held) => {
      expect(Services[name as keyof typeof WatchPartyServices]).toBe(held);
    }
  );
});
