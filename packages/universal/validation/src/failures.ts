import type { InputFailure } from '@vp/errors';

export interface LengthBounds {
  readonly minLength: number;
  readonly maxLength: number;
}

export type FieldFailure<C extends string, D extends object = Record<never, never>> = InputFailure<
  C,
  D
>;

export interface FieldFailures<C extends string> {
  invalidField<D extends object>(
    field: string,
    message: string,
    constraints: D
  ): FieldFailure<C, D>;
  invalidLength(field: string, bounds: LengthBounds): FieldFailure<C, LengthBounds>;
}

/**
 * The builders of every input rule without a code of its own, bound to the one code the app gives
 * such failures. One code on purpose: a union of two of these still switches exhaustively, and the
 * consumer reads `field` to know which input was rejected, which is exactly what `Problem.errors`
 * carries. A code per field would be a second error vocabulary.
 */
export function defineFieldFailures<C extends string>(code: C): FieldFailures<C> {
  const invalidField = <D extends object>(
    field: string,
    message: string,
    constraints: D
  ): FieldFailure<C, D> => ({ code, message, field, ...constraints });

  return {
    invalidField,
    invalidLength: (field, bounds) =>
      invalidField(
        field,
        `${field} must be between ${bounds.minLength} and ${bounds.maxLength} characters`,
        bounds
      ),
  };
}
