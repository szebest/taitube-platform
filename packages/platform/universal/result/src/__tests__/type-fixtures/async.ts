import { andThenAsync } from '../../async';
import { type Result, err, ok } from '../../result';

declare const settled: Result<number, 'A'>;

expectTypeOf(
  andThenAsync(Promise.resolve(settled), async (value) =>
    value > 0 ? ok(String(value)) : err('B' as const)
  )
).toEqualTypeOf<Promise<Result<string, 'A' | 'B'>>>();

expectTypeOf(andThenAsync(settled, (): Result<string, never> => ok('x'))).resolves.toEqualTypeOf<
  Result<string, 'A'>
>();

// @ts-expect-error the step answers a Result, not a bare value
andThenAsync(settled, (value) => value + 1);
