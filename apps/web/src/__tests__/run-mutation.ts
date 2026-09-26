import { MutationObserver, type MutationOptions, type QueryClient } from '@tanstack/react-query';

/** Runs mutation options the way `useMutation` does, settled either way, without mounting a component. */
export async function runMutation<TData, TVariables, TContext>(
  client: QueryClient,
  options: MutationOptions<TData, Error, TVariables, TContext>,
  variables: TVariables
): Promise<PromiseSettledResult<TData>> {
  const [settled] = await Promise.allSettled([
    new MutationObserver(client, options).mutate(variables),
  ]);
  return settled;
}

/** A reply the spec releases by hand, so it can look at the cache while the request is in flight. */
export function heldReply<T>(reply: () => T): { answer: () => Promise<T>; release: () => void } {
  let resolve = () => {};
  const released = new Promise<void>((settle) => {
    resolve = settle;
  });
  return {
    answer: async () => {
      await released;
      return reply();
    },
    release: () => resolve(),
  };
}
