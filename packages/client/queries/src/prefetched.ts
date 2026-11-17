import { fromPromise, ignore } from '@kit/result';
import { noop } from '@tanstack/react-query';

export async function prefetched(load: Promise<unknown>): Promise<void> {
  ignore(
    await fromPromise(load, noop),
    'a failed prefetch leaves the cache cold for the component to fill'
  );
}
