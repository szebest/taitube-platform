import { PlaylistServices } from '../playlist-tokens';
import { Services } from '../service-tokens';

describe('apps/server/api/composition: playlist tokens', () => {
  it.each(Object.entries(PlaylistServices))(
    'Services holds the very %s token, so a provider registered on one resolves through the other',
    (name, token) => {
      expect(Services[name as keyof typeof PlaylistServices]).toBe(token);
    }
  );
});
