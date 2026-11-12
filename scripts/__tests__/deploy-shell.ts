import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const DEPLOY_DIR = resolve(import.meta.dirname, '../deploy');
const MODULE_NAMES = ['common', 'preflight', 'compose', 'k8s-cluster', 'k8s-rollout', 'k8s'];

export interface DeployShell {
  dir: string;
  sourced: (body: string) => SpawnSyncReturns<string>;
  write: (name: string, value: string) => void;
  read: (name: string) => string;
  readOr: (name: string, fallback: string) => string;
}

/** Sources every scripts/deploy module into a bash in a fresh directory, with the environment variables deploy.sh sets. */
export function useDeployShell(): DeployShell {
  const shell = {} as DeployShell;

  beforeEach(() => {
    shell.dir = mkdtempSync(join(tmpdir(), 'deploy-sh-'));
  });

  afterEach(() => {
    rmSync(shell.dir, { recursive: true, force: true });
  });

  shell.sourced = (body) => {
    const preamble = [
      'ENV=compose-vm DRY_RUN=0 TAG="" SLUG="" YES=0 CONFIRM="" FOLLOW=0',
      ...MODULE_NAMES.map((name) => `. ${join(DEPLOY_DIR, `${name}.sh`)}`),
    ].join('\n');
    return spawnSync('bash', ['-c', `${preamble}\n${body}`], { cwd: shell.dir, encoding: 'utf8' });
  };
  shell.write = (name, value) => {
    mkdirSync(join(shell.dir, name, '..'), { recursive: true });
    writeFileSync(join(shell.dir, name), `${value}\n`);
  };
  shell.read = (name) => readFileSync(join(shell.dir, name), 'utf8').trim();
  shell.readOr = (name, fallback) => {
    try {
      return shell.read(name);
    } catch {
      return fallback;
    }
  };
  return shell;
}
