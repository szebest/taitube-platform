import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { type ComponentType, Fragment, type PropsWithChildren } from 'react';

/** The app's own providers a hook reads besides the query client, such as its API client. */
export type HookProviders = ComponentType<PropsWithChildren>;

/** Mounts a mutation hook over `client`, as a component under the app's providers runs it. */
export function renderMutation<T>(
  hook: () => T,
  client: QueryClient,
  Providers: HookProviders = Fragment
) {
  const { result } = renderHook(hook, {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <Providers>{children}</Providers>
      </QueryClientProvider>
    ),
  });
  return result;
}

type MutationHook<TData, TVariables> = () => {
  mutateAsync: (variables: TVariables) => Promise<TData>;
};

/** Mounts a mutation hook and runs it once, settled either way so a spec can assert a rejection. */
export async function runMutation<TData, TVariables>(
  client: QueryClient,
  hook: MutationHook<TData, TVariables>,
  variables: TVariables,
  Providers?: HookProviders
): Promise<PromiseSettledResult<TData>> {
  const [outcome] = await Promise.allSettled([
    renderMutation(hook, client, Providers).current.mutateAsync(variables),
  ]);
  if (!outcome) throw new Error('Promise.allSettled answered no outcome for one promise');
  return outcome;
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
