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

export function problemResponse(status: number): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'x', status, code: 'X', detail: 'x' }),
    { status, headers: { 'content-type': 'application/problem+json' } }
  );
}
