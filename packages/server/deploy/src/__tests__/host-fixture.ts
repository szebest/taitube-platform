import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { dump } from 'js-yaml';
import type { Environment } from '../environment-spec';
import type { DeployHost } from '../host';
import { COMPOSE, DOCS, PREVIEW, PRODUCTION } from './fixtures';

export interface FakeHost extends DeployHost {
  printed: string[];
  written: Map<string, string>;
}

export function workspace(
  environments: readonly Environment[] = [PRODUCTION, PREVIEW, COMPOSE]
): string {
  const root = mkdtempSync(join(tmpdir(), 'vp-deploy-'));
  for (const env of environments) {
    mkdirSync(join(root, 'infra/environments', env.name), { recursive: true });
    writeFileSync(join(root, 'infra/environments', env.name, 'environment.yaml'), dump(env));
  }
  return root;
}

export function fakeHost(root: string, overrides: Partial<DeployHost> = {}): FakeHost {
  const printed: string[] = [];
  const written = new Map<string, string>();
  return {
    root,
    docs: DOCS,
    isLocalCredential: (value) => value === 'minioadmin',
    now: () => new Date('2026-11-10T12:00:00.000Z'),
    readText: () => undefined,
    writeText: (path, text) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      written.set(path, text);
    },
    git: () => undefined,
    stdin: () => '',
    print: (text) => printed.push(text),
    printed,
    written,
    ...overrides,
  };
}
