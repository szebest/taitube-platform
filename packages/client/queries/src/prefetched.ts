import { noop } from '@tanstack/react-query';
import { fromPromise, ignore } from '@vp/result';

export async function prefetched(load: Promise<unknown>): Promise<void> {
  ignore(
    await fromPromise(load, noop),
    'a failed prefetch leaves the cache cold for the component to fill'
  );
}
