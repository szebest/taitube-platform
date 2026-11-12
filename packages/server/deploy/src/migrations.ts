import { parseJson } from '@vp/result';
import { z } from 'zod';

export const MIGRATIONS_DIR = 'packages/server/db/drizzle';

export interface GitChange {
  status: string;
  path: string;
}

/** `git diff --name-status` lines: `A<TAB>path`, `M<TAB>path`, `R100<TAB>old<TAB>new`. */
export function parseNameStatus(output: string): GitChange[] {
  return output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line) => {
      const [status = '', ...paths] = line.split('\t');
      return paths.map((path) => ({ status: status[0] ?? '', path }));
    });
}

const VERBS: Record<string, string> = { D: 'deleted', R: 'renamed' };

const isSql = (path: string) => /^\d{4}_.+\.sql$/.test(path.slice(MIGRATIONS_DIR.length + 1));
const isSnapshot = (path: string) => /\/meta\/\d{4}_snapshot\.json$/.test(path);

const Journal = z.object({ entries: z.array(z.object({ tag: z.string() })) });

function journalTags(text: string): string[] | undefined {
  const parsed = parseJson(text);
  const journal = parsed.ok ? Journal.safeParse(parsed.value) : undefined;
  return journal?.success ? journal.data.entries.map((entry) => entry.tag) : undefined;
}

/**
 * Forward-only: against the base, a migration file may only be added. Editing, deleting or renaming one
 * that shipped changes what a database that already ran it believes, so it is refused; the journal may
 * only grow at its end.
 */
export function migrationFindings(
  changes: readonly GitChange[],
  journals: { base: string | undefined; head: string | undefined }
): string[] {
  const findings = changes
    .filter((change) => change.path.startsWith(`${MIGRATIONS_DIR}/`))
    .filter((change) => (isSql(change.path) || isSnapshot(change.path)) && change.status !== 'A')
    .map(
      (change) =>
        `${change.path} was ${VERBS[change.status] ?? 'edited'}: a shipped migration never changes, add a new one`
    );

  if (journals.base !== undefined && journals.head !== undefined) {
    const before = journalTags(journals.base);
    const after = journalTags(journals.head);
    if (before === undefined || after === undefined) {
      findings.push(`${MIGRATIONS_DIR}/meta/_journal.json is not a drizzle journal`);
    } else if (before.some((tag, index) => after[index] !== tag)) {
      findings.push(
        `${MIGRATIONS_DIR}/meta/_journal.json rewrote an existing entry: it may only append`
      );
    }
  }
  return findings;
}
