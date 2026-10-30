import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const VIEWER: UserContext = { id: '00000000-0000-7000-8000-00000000f201', role: 'USER' };

describe('apps/server/api/composition: notification module', () => {
  it('hands the service the notifications the rest of the API writes', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));
    expectOk(
      await c.get(Adapters.Repositories).notifications.record({
        userId: VIEWER.id,
        kind: 'processing',
        actorChannelId: null,
        videoId: null,
        commentId: null,
        groupKey: null,
        payload: { actor: null, videoTitle: null, excerpt: null, outcome: 'ready' },
      })
    );

    const page = expectOk(
      await c.get(Services.NotificationService).list(VIEWER, { filter: 'all' })
    );

    expect(page.items.map((item) => item.kind)).toEqual(['processing']);
    expectOk(await c.dispose());
  });
});
