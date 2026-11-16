import { expectOk } from '@vp/testing/result';
import { createFakeApi } from '../../__tests__/fake-api';
import { createFakePorts } from '../../__tests__/fake-ports';
import { createApi } from '../../api';
import { listLibrary } from '../video-library';

describe('seed/scenarios: video-library', () => {
  it("lists the videos in the caller's studio library only", async () => {
    const fake = createFakeApi();
    const ports = createFakePorts({ fetch: fake.fetch });
    await fake.uploader.upload({
      token: 'token:creator:owner-a',
      filePath: '',
      title: 'A',
      contentType: '',
      onProgress: () => {},
    });
    await fake.uploader.upload({
      token: 'token:creator:owner-b',
      filePath: '',
      title: 'B',
      contentType: '',
      onProgress: () => {},
    });

    const library = expectOk(
      await listLibrary(createApi(ports, 'http://api.test'), { id: 'owner-a', role: 'creator' })
    );

    expect(library.map((video) => video.title)).toEqual(['A']);
  });
});
