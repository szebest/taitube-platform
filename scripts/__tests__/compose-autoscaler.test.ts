import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runEntrypoint } from '../../packages/platform/server/testing/src/run-entrypoint';

const ENTRYPOINT = path.resolve(import.meta.dirname, '../compose-autoscaler.ts');

function autoscaler(...argv: string[]) {
  return runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });
}

describe('scripts: pnpm compose-autoscaler', () => {
  it('runs the command it is given', () => {
    const help = autoscaler('--help');

    expect(help.status).toBe(0);
    expect(help.stdout).toContain('pnpm compose-autoscaler [options]');
    expect(help.stdout).toContain('http://localhost:9464/metrics');
  });

  it('logs why it could not start and exits 1', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-autoscaler-'));
    const missing = path.join(dir, 'stages.json');

    const refused = autoscaler('--config', missing);

    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('fatal compose-autoscaler failed');
    expect(refused.stderr).toContain('ENOENT');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
