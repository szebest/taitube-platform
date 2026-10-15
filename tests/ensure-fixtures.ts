import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FIXTURE_IDS = ['s2', 's15', 's60', 'not-a-video'];
const REPO_ROOT = resolve(import.meta.dirname, '..');

export function missingFixtureIds(fixturesDir: string): string[] {
  return FIXTURE_IDS.filter((id) => !existsSync(join(fixturesDir, `${id}.mp4`)));
}

export function ensureFixtures(
  fixturesDir: string,
  generate: (ids: string[]) => void
): void {
  const missing = missingFixtureIds(fixturesDir);
  if (missing.length > 0) {
    generate(missing);
  }
}

export default function ensureRepoFixtures(): void {
  ensureFixtures(join(REPO_ROOT, 'tests/fixtures'), (ids) => {
    execFileSync('pnpm', ['gen-video', '--only', ids.join(',')], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
  });
}
