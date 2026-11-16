import { expectErr, expectOk } from '@vp/testing/result';
import { createFakeApi } from '../../__tests__/fake-api';
import { createFakePorts } from '../../__tests__/fake-ports';
import { createApi } from '../../api';
import type { VideoSpec } from '../../world-types';
import { syncMetadata } from '../video-metadata';

const SPEC: VideoSpec = {
  key: 'v01',
  ownerId: 'owner',
  title: 'T',
  description: 'D',
  categorySlug: 'music',
  tags: ['a', 'b'],
  visibility: 'unlisted',
  shape: 'standard',
  seconds: 9,
  source: 'testsrc2',
  hue: 0,
  toneHz: 200,
};
const ACTOR = { id: 'owner', role: 'creator' };

async function setup() {
  const fake = createFakeApi();
  const api = createApi(createFakePorts({ fetch: fake.fetch }), 'http://api.test');
  const uploaded = expectOk(
    await fake.uploader.upload({
      token: 'token:creator:owner',
      filePath: '',
      title: 'T',
      contentType: '',
      onProgress: () => {},
    })
  );
  return { fake, api, id: uploaded.videoId };
}

describe('seed/scenarios: video-metadata', () => {
  it('edits what differs once and leaves a video that already matches alone', async () => {
    const { fake, api, id } = await setup();

    expect(expectOk(await syncMetadata(api, ACTOR, id, SPEC, 'cat-1'))).toBe(true);
    expect(expectOk(await syncMetadata(api, ACTOR, id, SPEC, 'cat-1'))).toBe(false);

    expect(fake.state.videos.get(id)).toMatchObject({
      visibility: 'unlisted',
      categoryId: 'cat-1',
      tags: ['a', 'b'],
      description: 'D',
    });
  });

  it('leaves the category alone when it is not known', async () => {
    const { fake, api, id } = await setup();

    expectOk(await syncMetadata(api, ACTOR, id, SPEC, null));

    expect(fake.state.videos.get(id)?.categoryId).toBeNull();
  });

  it('reports a video that is not there', async () => {
    const { api } = await setup();

    expect(expectErr(await syncMetadata(api, ACTOR, 'missing', SPEC, null))).toMatchObject({
      status: 404,
    });
  });
});
