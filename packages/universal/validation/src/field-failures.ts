import { defineFieldFailures, type FieldFailure } from '@kit/validation';
import { ErrorCodes } from '@vp/errors';

export type InvalidField<D extends object = Record<never, never>> = FieldFailure<
  typeof ErrorCodes.VALIDATION_FAILED,
  D
>;

export const { invalidField, invalidLength } = defineFieldFailures(ErrorCodes.VALIDATION_FAILED);
