import { ErrorCodes, type InputFailure } from '@vp/errors';

/**
 * The shape every input rule without a code of its own returns. `VALIDATION_FAILED` is one code
 * on purpose - a union of two of these still switches exhaustively, and the consumer reads
 * `field` to know which input was rejected, which is exactly what `Problem.errors` carries.
 * Inventing a code per field would be the second error vocabulary this design exists to avoid.
 */
export type InvalidField<D extends object = Record<never, never>> = InputFailure<
  typeof ErrorCodes.VALIDATION_FAILED,
  D
>;

export function invalidField<D extends object>(
  field: string,
  message: string,
  constraints: D
): InvalidField<D> {
  return { code: ErrorCodes.VALIDATION_FAILED, message, field, ...constraints };
}

export interface LengthBounds {
  readonly minLength: number;
  readonly maxLength: number;
}

export function invalidLength(
  field: string,
  bounds: LengthBounds
): InvalidField<LengthBounds> {
  return invalidField(
    field,
    `${field} must be between ${bounds.minLength} and ${bounds.maxLength} characters`,
    bounds
  );
}
