import { type ErrorClassification, attemptsFor, classifyError, errorCodeOf } from '../../classify';
import { isRegisteredCode, retryClass } from '../../registry';
import { codes } from '../fixtures';

declare const thrown: unknown;

expectTypeOf(classifyError(codes, thrown)).toEqualTypeOf<ErrorClassification>();
expectTypeOf(attemptsFor(codes, thrown, 3)).toEqualTypeOf<number>();
expectTypeOf(errorCodeOf(codes, thrown)).toEqualTypeOf<'NOT_FOUND' | 'DOWN' | 'INTERNAL'>();
expectTypeOf(retryClass(codes, 'DOWN')).toEqualTypeOf<'permanent' | 'transient'>();

if (isRegisteredCode(codes, thrown)) {
  expectTypeOf(thrown).toEqualTypeOf<'NOT_FOUND' | 'DOWN' | 'INTERNAL'>();
}

// @ts-expect-error the set is the first argument
classifyError(thrown, codes);

// @ts-expect-error the attempts a policy allows are a number
attemptsFor(codes, thrown, '3');

// @ts-expect-error a retry class is looked up by a code string
retryClass(codes, 1);
