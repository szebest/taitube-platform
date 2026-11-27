import type { Result } from '../../result';
import { fromPromise, tryCatch } from '../../try-catch';

expectTypeOf(
  tryCatch(
    () => 1,
    () => 'failed' as const
  )
).toEqualTypeOf<Result<number, 'failed'>>();
expectTypeOf(fromPromise(Promise.resolve('x'), () => 'failed' as const)).toEqualTypeOf<
  Promise<Result<string, 'failed'>>
>();
expectTypeOf(
  fromPromise(
    () => Promise.resolve(1),
    (cause) => cause
  )
).toEqualTypeOf<Promise<Result<number, unknown>>>();

// @ts-expect-error the failure is built from the cause
tryCatch(() => 1, 'failed');

// @ts-expect-error a promise or a thunk of one, not a bare value
fromPromise(1, () => 'failed');
