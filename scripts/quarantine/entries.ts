import { readFileSync } from 'node:fs';
import { isAbsolute, join, matchesGlob, relative } from 'node:path';

/** A spec CI skips while its owner fixes it; `flake-hunt` keeps running it. */
export interface QuarantineEntry {
  spec: string;
  owner: string;
  reason: string;
  /** `YYYY-MM-DD`, after which the architecture suite fails the entry. */
  expires: string;
  ticket: string;
}

const MAX_QUARANTINED = 5;

const REPO = join(import.meta.dirname, '../..');

const QUARANTINE_FILE = join(REPO, 'tests/quarantine.json');

export const readQuarantine = (): QuarantineEntry[] =>
  JSON.parse(readFileSync(QUARANTINE_FILE, 'utf8')) as QuarantineEntry[];

const GLOB_CHARACTERS = /[*?[\]{}()!+@]/;

/**
 * The `--exclude` pattern for one spec: its absolute path. vitest matches an exclude inside every
 * project, so a relative tail (`src/__tests__/channels.test.ts`) would skip every package's spec of
 * that name; a path with glob characters cannot be named alone, so the rules refuse it.
 */
export const vitestExclude = (spec: string): string => join(REPO, spec);

/** The specs, by repo path, an exclude pattern matches; a quarantine entry's must be exactly its own. */
export const excludedBy = (pattern: string, specs: readonly string[]): string[] => {
  const fromRepo = isAbsolute(pattern) ? relative(REPO, pattern) : pattern;
  return specs.filter((spec) => matchesGlob(spec, fromRepo));
};

/** Each entry wrong in itself, or one too many, in words; empty when the quarantine holds. */
export function quarantineFindings(
  entries: readonly Partial<QuarantineEntry>[],
  today: string
): string[] {
  const findings = entries.flatMap((entry) => {
    const name = entry.spec ?? 'an entry with no spec';
    const missing = (['spec', 'owner', 'reason', 'expires', 'ticket'] as const).filter(
      (field) => !entry[field]
    );
    return [
      ...missing.map((field) => `${name}: no ${field}`),
      ...(entry.expires && entry.expires < today ? [`${name}: expired on ${entry.expires}`] : []),
      ...(entry.spec && GLOB_CHARACTERS.test(entry.spec)
        ? [`${name}: its path holds glob characters, so no exclude names it alone`]
        : []),
    ];
  });
  if (entries.length > MAX_QUARANTINED) {
    findings.push(`${entries.length} entries, over the ${MAX_QUARANTINED} the quarantine holds`);
  }
  return findings;
}

/** The failing specs no entry quarantines: each is a flake to fix or quarantine, never a rerun. */
export const unquarantined = (
  failing: readonly string[],
  entries: readonly QuarantineEntry[]
): string[] => failing.filter((spec) => !entries.some((entry) => entry.spec === spec));
