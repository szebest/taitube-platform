import { all, andThen, ignoreRejection, map, unwrapOr } from '../../combinators';
import { type Err, type Ok, type Result, err, ok } from '../../result';

declare const result: Result<number, 'A'>;
declare const results: readonly Result<number, 'A'>[];

expectTypeOf(ok()).toEqualTypeOf<Ok<void>>();
expectTypeOf(ok(1)).toEqualTypeOf<Ok<number>>();
expectTypeOf(err('A' as const)).toEqualTypeOf<Err<'A'>>();
expectTypeOf(map(result, (value) => String(value))).toEqualTypeOf<Result<string, 'A'>>();
expectTypeOf(andThen(result, (value) => (value > 0 ? ok(value) : err('B' as const)))).toEqualTypeOf<
  Result<number, 'A' | 'B'>
>();
expectTypeOf(unwrapOr(result, 0)).toEqualTypeOf<number>();
expectTypeOf(all(results)).toEqualTypeOf<Result<number[], 'A'>>();

// @ts-expect-error a fallback is of the value's type
unwrapOr(result, 'none');

// @ts-expect-error the step of andThen answers a Result, not a bare value
andThen(result, (value) => value + 1);

// @ts-expect-error every result of a list shares one value type
all([ok(1), ok('one')]);

expectTypeOf(ignoreRejection<'progress is advisory'>)
  .parameter(0)
  .toEqualTypeOf<PromiseLike<unknown>>();
expectTypeOf(ignoreRejection<'progress is advisory'>)
  .parameter(1)
  .toEqualTypeOf<'progress is advisory'>();
expectTypeOf(ignoreRejection<'x'>).returns.toEqualTypeOf<void>();

function _rejectionSpelledOut(): void {
  ignoreRejection(Promise.reject(new Error('gone')), 'the beacon is best effort');
}

function _rejectionFromAVariable(reason: string): void {
  // @ts-expect-error a reason held in a variable could say anything, so it justifies nothing
  ignoreRejection(Promise.resolve(1), reason);
}

function _rejectionEmpty(): void {
  // @ts-expect-error an empty reason is no reason
  ignoreRejection(Promise.resolve(1), '');
}

function _rejectionNotAPromise(): void {
  // @ts-expect-error only a promise-like is dropped through ignoreRejection
  ignoreRejection(42, 'a number is not a promise');
}
