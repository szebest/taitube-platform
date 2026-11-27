import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { uploadRendition } from '../upload-rendition';

describe('worker: apply-edits rendition upload', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-upload-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('uploads every rendered file under the prefix, the playlist last', async () => {
    for (const name of ['index.m3u8', 'seg_00000.ts', 'seg_00001.ts']) {
      await fs.writeFile(path.join(dir, name), name);
    }
    const storage = new InMemoryStorageClient();
    const upload = vi.spyOn(storage, 'uploadObject');

    expectOk(await uploadRendition(storage, 'public', dir, 'videos/v/hls/g2/720p/'));

    expect(upload.mock.calls.map(([params]) => params.key)).toEqual([
      'videos/v/hls/g2/720p/seg_00000.ts',
      'videos/v/hls/g2/720p/seg_00001.ts',
      'videos/v/hls/g2/720p/index.m3u8',
    ]);
    expect(upload.mock.calls.at(-1)?.[0].contentType).toBe('application/vnd.apple.mpegurl');
  });

  it('refuses a rendition that wrote no playlist', async () => {
    await fs.writeFile(path.join(dir, 'seg_00000.ts'), 'x');

    expect(
      expectErr(await uploadRendition(new InMemoryStorageClient(), 'public', dir, 'p/')).code
    ).toBe(ErrorCodes.SEGMENT_VERIFY_FAILED);
  });
});
