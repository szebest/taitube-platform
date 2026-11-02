import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const QUARANTINE_FILE = join(import.meta.dirname, '../../tests/quarantine.json');

export const readQuarantine = (): QuarantineEntry[] =>
  JSON.parse(readFileSync(QUARANTINE_FILE, 'utf8')) as QuarantineEntry[];

const PROJECT_ROOT = /^(apps\/[^/]+\/[^/]+|packages\/[^/]+\/[^/]+|tests\/[^/]+|scripts)\//;

/** The `--exclude` glob that matches a repo path inside whichever vitest project runs it. */
export const vitestExclude = (spec: string): string => `**/${spec.replace(PROJECT_ROOT, '')}`;

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
