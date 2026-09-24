import type { Result } from './result';

export type Awaitable<T> = T | Promise<T>;

export async function andThenAsync<T, U, E, F>(
  result: Awaitable<Result<T, E>>,
  fn: (value: T) => Awaitable<Result<U, F>>
): Promise<Result<U, E | F>> {
  const settled = await result;
  return settled.ok ? await fn(settled.value) : settled;
}
