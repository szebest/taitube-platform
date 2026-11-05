import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectErr, expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const VIEWER = { id: '00000000-0000-7000-8000-00000000f501', role: 'USER' } as const;

async function composed(hookSecret: string | undefined) {
  const config = inProcessAppConfig();
  const c = registerServices(
    await registerAdapters(new Container(), { ...config, live: { ...config.live, hookSecret } })
  );
  expectOk(
    await c
      .get(Adapters.Repositories)
      .channels.create({ userId: VIEWER.id, handle: 'viewer', displayName: 'Viewer' })
  );
  return c;
}

describe('apps/server/api/composition: live module', () => {
  it('mints a URL-safe stream key that the ingest hook then takes live', async () => {
    const c = await composed('hook-secret');

    const opened = expectOk(await c.get(Services.CreatorLiveService).open(VIEWER));
    const streamKey = opened.ingest?.streamKey ?? '';
    expectOk(
      await c.get(Services.LiveIngestService).authorize({
        presentedSecret: 'hook-secret',
        call: { action: 'publish', path: `live/${streamKey}`, user: '', password: '' },
      })
    );

    expect(streamKey).toMatch(/^[\w-]{32}$/);
    expect(expectOk(await c.get(Services.CreatorLiveService).current(VIEWER)).status).toBe('LIVE');
    expectOk(await c.dispose());
  });

  it('refuses every ingest call when no hook secret is configured', async () => {
    const c = await composed(undefined);
    const opened = expectOk(await c.get(Services.CreatorLiveService).open(VIEWER));

    const refused = await c.get(Services.LiveIngestService).authorize({
      presentedSecret: '',
      call: { action: 'publish', path: `live/${opened.ingest?.streamKey}`, user: '', password: '' },
    });

    expect(expectErr(refused)).toMatchObject({ code: 'LIVE_INGEST_REFUSED' });
    expectOk(await c.dispose());
  });
});
