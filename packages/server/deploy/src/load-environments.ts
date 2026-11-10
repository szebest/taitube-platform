import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Environment } from './environment-spec';
import { parseEnvironment } from './parse-environment';

export const ENVIRONMENTS_DIR = 'infra/environments';
const ENVIRONMENT_FILE = 'environment.yaml';

export interface LoadedEnvironments {
  environments: Environment[];
  problems: string[];
}

/** Every directory under `infra/environments` except the underscore ones (the template) holds one. */
export function environmentDirs(root: string): string[] {
  const base = join(root, ENVIRONMENTS_DIR);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();
}

export function loadEnvironments(root: string): LoadedEnvironments {
  const environments: Environment[] = [];
  const problems: string[] = [];
  for (const dir of environmentDirs(root)) {
    const file = join(root, ENVIRONMENTS_DIR, dir, ENVIRONMENT_FILE);
    if (!existsSync(file)) {
      problems.push(`${dir}: ${ENVIRONMENTS_DIR}/${dir}/${ENVIRONMENT_FILE} is missing`);
      continue;
    }
    const parsed = parseEnvironment(dir, readFileSync(file, 'utf8'));
    if (parsed.ok) environments.push(parsed.value);
    else problems.push(...parsed.error);
  }
  return { environments, problems };
}
