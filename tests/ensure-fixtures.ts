import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FIXTURE_IDS = ['s2', 's15', 's60', 'not-a-video'];
const REPO_ROOT = resolve(import.meta.dirname, '..');

function missingFixtureIds(fixturesDir: string): string[] {
  return FIXTURE_IDS.filter((id) => !existsSync(join(fixturesDir, `${id}.mp4`)));
}

export function ensureFixtures(
  fixturesDir: string,
  generate: (ids: string[]) => void,
  ids: readonly string[] = FIXTURE_IDS
): void {
  const missing = missingFixtureIds(fixturesDir).filter((id) => ids.includes(id));
  if (missing.length > 0) {
    generate(missing);
  }
}

/** Generates whichever of `ids` the checkout lacks, so a suite never starts on a fixture CI did not fetch. */
export function ensureRepoFixtureIds(ids: readonly string[]): void {
  ensureFixtures(
    join(REPO_ROOT, 'tests/fixtures'),
    (missing) => {
      execFileSync('pnpm', ['gen-video', '--only', missing.join(',')], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
      });
    },
    ids
  );
}

export default function ensureRepoFixtures(): void {
  ensureRepoFixtureIds(FIXTURE_IDS);
}
