import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectErr, expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const VIEWER = { id: '00000000-0000-7000-8000-00000000f501', role: 'USER' } as const;

describe('apps/server/api/composition: integration module', () => {
  it('registers a webhook through the repositories the rest of the API shares', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));

    const created = expectOk(
      await c
        .get(Services.WebhookService)
        .create(VIEWER, { url: 'https://hooks.example.com/in', events: ['video.ready'] })
    );

    expect(expectOk(await c.get(Adapters.Repositories).webhooks.listByOwner(VIEWER.id))).toEqual([
      expect.objectContaining({ id: created.id, secret: created.secret }),
    ]);
    expectOk(await c.dispose());
  });

  it('refuses an oEmbed url of another site', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));

    const failure = expectErr(
      await c
        .get(Services.OEmbedService)
        .embed({ url: 'https://elsewhere.test/watch/x', format: 'json' })
    );

    expect(failure).toMatchObject({ code: 'OEMBED_URL_UNSUPPORTED' });
    expectOk(await c.dispose());
  });
});
