import type { ExampleEntry } from '../../scripts/env-docs/parse-example';

interface Doc {
  description: string;
  example: string;
  visibility: 'secret' | 'public';
  readBy: readonly string[];
}

const PLACEHOLDER = /<[^>]+>/;

const REGISTRY = 'packages/server/env-schema/src/env-docs-*.ts';
const EXTRA_REGISTRY = 'packages/server/env-schema/src/env-docs-extra.ts';

/** What is wrong with each entry of a registry, each finding naming the file to edit. */
export function docFindings(docs: Record<string, Doc>, registry: string): string[] {
  return Object.entries(docs).flatMap(([key, doc]) => {
    const problems = [
      doc.description.trim() === '' && 'has an empty description',
      doc.example.trim() === '' && 'has an empty example',
      doc.readBy.length === 0 && 'names no reader',
      doc.visibility === 'secret' &&
        !PLACEHOLDER.test(doc.example) &&
        'is secret but its example is not a <placeholder>',
    ].filter((problem) => problem !== false);
    return problems.map(
      (problem) => `${key} ${problem}: fix its entry in ${registry}, then run pnpm gen:env-docs`
    );
  });
}

/** The `.env.example` keys that neither the schema nor a documented extra key declares. */
export function unknownExampleKeys(
  entries: readonly ExampleEntry[],
  declared: ReadonlySet<string>
): string[] {
  const unknown = new Set(entries.map((entry) => entry.key).filter((key) => !declared.has(key)));
  return [...unknown].map(
    (key) =>
      `${key} is in .env.example but is not in AppEnvSchema (app-env.ts) or EXTRA_ENV_DOCS (${EXTRA_REGISTRY}): declare and document it, or remove the line`
  );
}

/** The keys that must show as `secret`: whatever the schema builds with `secret()` or lists as a secret key. */
export function secretSchemaKeys(appEnvSource: string, secretKeys: readonly string[]): string[] {
  const built = [...appEnvSource.matchAll(/^\s+([A-Z][A-Z0-9_]*): secret\(\)/gm)].map(
    (m) => m[1] as string
  );
  return [...new Set([...secretKeys, ...built])];
}

/** Keys whose visibility disagrees with the `secret()` marks, the lock marks and the SECRET_KEYS list. */
export function visibilityFindings(
  docs: Record<string, Pick<Doc, 'visibility'>>,
  secretByCode: readonly string[],
  entries: readonly ExampleEntry[]
): string[] {
  const locked = new Set(entries.filter((entry) => entry.secret).map((entry) => entry.key));
  const should = new Set([...secretByCode, ...locked]);

  const findings: string[] = [];
  for (const key of should) {
    const doc = docs[key];
    if (doc && doc.visibility !== 'secret') {
      findings.push(
        `${key} is a secret (SECRET_KEYS, secret() or a lock mark in .env.example) but its entry says public: set visibility to 'secret' in ${REGISTRY}, then run pnpm gen:env-docs`
      );
    }
  }
  for (const key of secretByCode) {
    if (!locked.has(key)) {
      findings.push(`${key} is a secret but .env.example has no 🔒 mark on it: mark it`);
    }
  }
  return findings;
}

/** A locked key that .env.example sets to something other than a placeholder or a shipped local credential. */
export function lockedValueFindings(
  entries: readonly ExampleEntry[],
  isLocalCredential: (value: string) => boolean
): string[] {
  return entries
    .filter((entry) => entry.secret && !entry.commented && entry.value !== '')
    .filter((entry) => !PLACEHOLDER.test(entry.value) && !isLocalCredential(entry.value))
    .map(
      (entry) =>
        `${entry.key} is a 🔒 secret with a real-looking value in .env.example: leave it empty, use a <placeholder>, or use a tracked local credential (local-credentials.ts)`
    );
}
