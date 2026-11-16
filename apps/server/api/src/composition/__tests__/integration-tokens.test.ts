import { IntegrationServices } from '../integration-tokens';
import { Services } from '../service-tokens';

describe('apps/server/api/composition: integration tokens', () => {
  it.each(Object.entries(IntegrationServices))(
    '%s is the very token Services holds, so a provider registered on one resolves through the other',
    (name, held) => {
      expect(Services[name as keyof typeof IntegrationServices]).toBe(held);
    }
  );
});
