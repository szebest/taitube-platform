import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000f301', role: 'USER' };

describe('apps/server/api/composition: watch party module', () => {
  it('composes a room service whose rooms the owner then reads back', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));
    expectOk(
      await c
        .get(Adapters.Repositories)
        .channels.create({ userId: OWNER.id, handle: 'owner', displayName: 'Owner' })
    );
    const service = c.get(Services.WatchPartyService);

    const created = expectOk(
      await service.create(
        { user: OWNER, party: null, ip: '198.51.100.1' },
        { visibility: 'unlisted', preset: 'friends', hostAs: 'user' }
      )
    );
    const read = expectOk(
      await service.get(created.id, { user: OWNER, party: null, ip: '198.51.100.1' }, undefined)
    );

    expect(read.id).toBe(created.id);
    expect(c.get(Services.WatchPartyBroadcaster)).toBe(c.get(Services.WatchPartyBroadcaster));
    expectOk(await c.dispose());
  });
});
