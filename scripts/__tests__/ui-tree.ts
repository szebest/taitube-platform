import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const REPO = resolve(import.meta.dirname, '../..');

const UI = join(REPO, 'packages/client/ui');

/**
 * A copy of `@vp/ui`'s sources laid out as a repo root, made inside `packages/client/ui` so its
 * imports still resolve through that package's `node_modules`. `remove` deletes it.
 */
export function uiTree(): Readonly<{ root: string; remove: () => void }> {
  const root = mkdtempSync(join(UI, '.scaffold-'));
  cpSync(join(UI, 'src'), join(root, 'packages/client/ui/src'), { recursive: true });
  return { root, remove: () => rmSync(root, { recursive: true, force: true }) };
}
