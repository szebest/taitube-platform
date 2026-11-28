import { Container } from '@kit/composition';
import { expectOk } from '@kit/testing/result';
import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { Services, registerServices } from '../services.module';

const OWNER = { id: '00000000-0000-7000-8000-00000000f501', role: 'USER' } as const;

describe('apps/server/api/composition: playlist module', () => {
  it('invites with a share-link token over the repositories the rest of the API shares', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));
    await seedPrimaryChannel(c.get(Adapters.Repositories), OWNER.id);
    const playlist = expectOk(
      await c.get(Services.PlaylistService).create(OWNER, { title: 'Ours' })
    );

    const link = expectOk(
      await c
        .get(Services.PlaylistCollaborationService)
        .createLink(OWNER, playlist.id, { role: 'editor', maxUses: null })
    );

    expect(link.token).toHaveLength(22);
    expectOk(await c.dispose());
  });
});
