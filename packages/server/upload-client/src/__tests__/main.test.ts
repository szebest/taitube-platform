import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ENTRYPOINT = resolve(import.meta.dirname, '../main.ts');

function uploadClient(...argv: string[]) {
  return spawnSync('bun', [ENTRYPOINT, ...argv], {
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('packages/upload-client: pnpm upload-client', () => {
  it('prints the usage and exits 0 with no file', () => {
    const help = uploadClient('--help');

    expect(help.status).toBe(0);
    expect(help.stdout).toContain('pnpm upload-client <file>');
  });

  it('logs why the upload failed and exits 1', () => {
    const missing = uploadClient('/no/such/video.mp4');

    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('fatal upload failed');
    expect(missing.stderr).toContain('File not found at "/no/such/video.mp4"');
  });
});
