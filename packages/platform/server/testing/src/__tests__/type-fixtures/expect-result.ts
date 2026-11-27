import { type Result, err, ok } from '@kit/result';
import { expectErr, expectOk } from '../../result';

declare const result: Result<number, { readonly code: 'BAD' }>;

expectTypeOf(expectOk(result)).toEqualTypeOf<number>();
expectTypeOf(expectErr(result)).toEqualTypeOf<{ readonly code: 'BAD' }>();
expectTypeOf(expectOk(ok('x'))).toEqualTypeOf<string>();
expectTypeOf(expectErr(err('x'))).toEqualTypeOf<string>();

// @ts-expect-error a bare value is not a Result
expectOk(1);
