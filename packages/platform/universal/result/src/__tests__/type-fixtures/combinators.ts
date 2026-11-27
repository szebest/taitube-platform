import { all, andThen, map, unwrapOr } from '../../combinators';
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
