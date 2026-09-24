import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const ENTRYPOINT = path.resolve(import.meta.dirname, '../main.ts');

function autoscaler(...argv: string[]) {
  return spawnSync('bun', [ENTRYPOINT, ...argv], {
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('packages/compose-autoscaler: pnpm compose-autoscaler', () => {
  it('runs the command it is given', () => {
    const help = autoscaler('--help');

    expect(help.status).toBe(0);
    expect(help.stdout).toContain('pnpm compose-autoscaler [options]');
  });

  it('prints why it could not start and exits 1', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-autoscaler-'));
    const missing = path.join(dir, 'stages.json');

    const refused = autoscaler('--config', missing);

    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('compose-autoscaler: ENOENT');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
