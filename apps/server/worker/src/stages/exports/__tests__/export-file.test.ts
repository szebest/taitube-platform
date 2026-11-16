import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { openExportFile } from '../export-file';

describe('worker/exports: export file', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-export-file-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes every chunk in order and counts its bytes as UTF-8', async () => {
    const target = path.join(dir, 'out.csv');
    const file = openExportFile(target);

    await file.write('a,ż\r\n');
    await file.write('x'.repeat(100_000));
    await file.close();

    expect(file.bytes).toBe(6 + 100_000);
    expect((await fs.stat(target)).size).toBe(file.bytes);
  });
});
