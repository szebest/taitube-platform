import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const ENTRYPOINT = path.resolve(import.meta.dirname, '../main.ts');

function genVideo(...argv: string[]) {
  return spawnSync('bun', [ENTRYPOINT, ...argv], {
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('packages/gen-video: pnpm gen-video', () => {
  it('runs the command it is given', () => {
    const help = genVideo('--help');

    expect(help.status).toBe(0);
    expect(help.stdout).toContain('pnpm gen-video [options]');
  });

  it('prints why generation failed and exits 1', () => {
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
    expect(blocked.stderr).toContain('[gen-video] ENOTDIR');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
