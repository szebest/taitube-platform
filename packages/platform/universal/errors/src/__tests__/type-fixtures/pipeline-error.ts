import { asThrowable, toPipelineError } from '../../classify';
import type { PermanentError, TransientError } from '../../pipeline-error';
import { codes } from '../fixtures';

declare const thrown: unknown;

expectTypeOf(toPipelineError(codes, { code: 'DOWN', message: 'down' })).toEqualTypeOf<
  PermanentError | TransientError
>();
expectTypeOf(asThrowable(codes, thrown)).toEqualTypeOf<Error>();

// @ts-expect-error a failure carries a code and a message
toPipelineError(codes, { code: 'DOWN' });
