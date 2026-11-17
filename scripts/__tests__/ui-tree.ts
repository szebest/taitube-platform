import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { UI_SRC } from '../scaffold';
import { packageDir } from '../workspace-packages';

export const REPO = resolve(import.meta.dirname, '../..');

const UI = join(REPO, packageDir('@kit/ui'));

/**
 * A copy of `@kit/ui`'s sources laid out as a repo root, made inside that package's directory so its
 * imports still resolve through that package's `node_modules`. `remove` deletes it.
 */
export function uiTree(): Readonly<{ root: string; remove: () => void }> {
  const root = mkdtempSync(join(UI, '.scaffold-'));
  cpSync(join(UI, 'src'), join(root, UI_SRC), { recursive: true });
  return { root, remove: () => rmSync(root, { recursive: true, force: true }) };
}
