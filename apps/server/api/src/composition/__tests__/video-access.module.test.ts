import { Container } from '@kit/composition';
import { expectErr, expectOk } from '@kit/testing/result';
import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { registerServices, Services } from '../services.module';

const OWNER = { id: '00000000-0000-7000-8000-00000000f601', role: 'CREATOR' } as const;
const VIDEO = '00000000-0000-7000-8000-00000000f602';
const PASSWORD = 'open sesame';

async function composed(secret: string | undefined) {
  const config = inProcessAppConfig();
  const c = registerServices(
    await registerAdapters(new Container(), { ...config, videoAccess: { secret } })
  );
  expectOk(
    await c.get(Adapters.Repositories).videos.create({
      id: VIDEO,
      ownerId: OWNER.id,
      title: 'Guarded',
      visibility: 'unlisted',
      status: 'READY',
      sourceKey: `raw/${VIDEO}.mp4`,
    })
  );
  return c;
}

describe('apps/server/api/composition: video access module', () => {
  it('signs an unlock with the configured secret that the watch read then accepts', async () => {
    const c = await composed('video-access-secret');
    expectOk(await c.get(Services.VideoPasswordService).set(OWNER, VIDEO, PASSWORD));

    const { credential } = expectOk(
      await c.get(Services.VideoPasswordService).unlock(null, VIDEO, PASSWORD)
    );
    const watch = (presented: string | null) =>
      c.get(Services.VideoWatchService).watch(null, VIDEO, {
        shareToken: null,
        credential: presented,
        sessionKey: null,
      });

    expect(expectOk(await watch(credential)).id).toBe(VIDEO);
    expect(expectErr(await watch(null)).code).toBe(ErrorCodes.VIDEO_PASSWORD_REQUIRED);
    expectOk(await c.dispose());
  });

  it('turns video passwords off without a secret', async () => {
    const c = await composed(undefined);

    expect(
      expectErr(await c.get(Services.VideoPasswordService).set(OWNER, VIDEO, PASSWORD)).code
    ).toBe(ErrorCodes.VIDEO_PASSWORDS_OFF);
    expectOk(await c.dispose());
  });

  it('mints share tokens a link can be opened with', async () => {
    const c = await composed(undefined);

    const link = expectOk(
      await c.get(Services.ShareLinkService).create(OWNER, VIDEO, { expiresIn: '1h' })
    );

    expect(link.token).toMatch(/^[\w-]{22}$/);
    expectOk(await c.dispose());
  });
});
