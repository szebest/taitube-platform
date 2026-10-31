import { fromPromise, isOk } from '@vp/result';

const PROBE_URL = '/robots.txt';

/** Asks the server for a small file the worker does not hold, so only a live connection answers. */
export async function connectionIsBack(): Promise<boolean> {
  const answer = await fromPromise(
    fetch(PROBE_URL, { method: 'HEAD', cache: 'no-store' }),
    (cause) => cause
  );
  return isOk(answer) && answer.value.ok;
}
