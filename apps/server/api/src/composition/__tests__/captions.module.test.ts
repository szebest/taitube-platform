import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import {
  CAPTIONED,
  CAPTION_OWNER,
  VTT,
  seedCaptionVideos,
} from '../../services/__tests__/caption-fixture';
import { Services, registerServices } from '../services.module';

describe('apps/server/api/composition: captions module', () => {
  it('hands both caption services the same repositories, and the CDN the rest of the API reads', async () => {
    const c = registerServices(
      await registerAdapters(new Container(), inProcessAppConfig({ cdn: 'http://cdn.example/' }))
    );
    await seedCaptionVideos(c.get(Adapters.Repositories));

    expectOk(await c.get(Services.CaptionTrackService).upload(CAPTION_OWNER, CAPTIONED, 'en', VTT));
    const listed = expectOk(await c.get(Services.CaptionService).list(null, CAPTIONED));

    expect(listed.tracks.map((track) => track.url)).toEqual([
      `http://cdn.example/videos/${CAPTIONED}/captions/en/captions.vtt`,
    ]);
    expectOk(await c.dispose());
  });
});
