import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runEntrypoint } from '@vp/testing/run-entrypoint';

const ENTRYPOINT = path.resolve(import.meta.dirname, '../main.ts');

function genVideo(...argv: string[]) {
  return runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });
}

describe('packages/gen-video: pnpm gen-video', () => {
  it('runs the command it is given', () => {
    const help = genVideo('--help');

    expect(help.status).toBe(0);
    expect(help.stdout).toContain('pnpm gen-video [options]');
  });

  it('logs why generation failed and exits 1', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-gen-video-'));
    const blocker = path.join(dir, 'a-file');
    fs.writeFileSync(blocker, '');

    const blocked = genVideo(
      '--output-dir',
      path.join(blocker, 'fixtures'),
      '--only',
      'zero-bytes'
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain('fatal fixture generator failed');
    expect(blocked.stderr).toContain('ENOTDIR');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
