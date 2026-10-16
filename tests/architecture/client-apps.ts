import { posix } from 'node:path';
import { trackedFiles } from './repo-files';

/** Every app under `apps/client/`, read from its manifest: the one list the browser-side rows share. */
export function clientApps(): string[] {
  return trackedFiles(':(glob)apps/client/*/package.json').map(posix.dirname);
}
