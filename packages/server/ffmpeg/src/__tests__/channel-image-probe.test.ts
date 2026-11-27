import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ErrorCodes } from '@vp/errors';
import { probeChannelImage } from '../channel-image-probe';

describe('@vp/ffmpeg: channel image probe', () => {
  describe('with the real ffprobe', () => {
    let dir: string;
    const options = { ffprobePath: 'ffprobe', timeoutMs: 20_000 };

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-image-probe-'));
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('reads a generated PNG and refuses bytes that are no image', async () => {
      const png = path.join(dir, 'a.png');
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=red:s=320x200',
        '-frames:v',
        '1',
        png,
      ]);
      const junk = path.join(dir, 'junk');
      fs.writeFileSync(junk, 'not an image at all');

      expect(await probeChannelImage(png, options)).toEqual({
        format: 'png',
        width: 320,
        height: 200,
      });
      await expect(probeChannelImage(junk, options)).rejects.toMatchObject({
        code: ErrorCodes.CORRUPT_CONTAINER,
      });
    });
  });
});
