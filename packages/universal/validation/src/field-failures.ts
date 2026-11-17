import { ErrorCodes } from '@vp/errors';
import { defineFieldFailures, type FieldFailure } from './failures';

export type InvalidField<D extends object = Record<never, never>> = FieldFailure<
  typeof ErrorCodes.VALIDATION_FAILED,
  D
>;

export const { invalidField, invalidLength } = defineFieldFailures(ErrorCodes.VALIDATION_FAILED);
