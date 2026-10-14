import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fromPromise, ignore } from '@vp/result';

/** A per-job directory under the worker's tmp root; the caller removes it in its `finally`. */
export async function createScratchDir(root: string, prefix: string): Promise<string> {
  await fs.mkdir(root, { recursive: true });
  return fs.mkdtemp(path.join(root, prefix));
}

export async function removeScratchDir(dir: string): Promise<void> {
  ignore(
    await fromPromise(
      () => fs.rm(dir, { recursive: true, force: true }),
      (cause) => cause
    ),
    'a directory left behind is removed by the tmp-sweep housekeeping task'
  );
}
