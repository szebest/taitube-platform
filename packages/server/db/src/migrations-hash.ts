import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** One digest of every SQL file and the journal: equal digests mean nothing is left to apply. */
export function migrationsHash(folder: string): string {
  const hash = createHash('sha256');
  const sqlFiles = fs
    .readdirSync(folder)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of sqlFiles) {
    hash.update(fs.readFileSync(path.join(folder, file)));
  }
  const journal = path.join(folder, 'meta', '_journal.json');
  if (fs.existsSync(journal)) {
    hash.update(fs.readFileSync(journal));
  }
  return hash.digest('hex');
}
