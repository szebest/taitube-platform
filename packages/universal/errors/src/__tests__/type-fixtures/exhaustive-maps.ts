import { type ErrorCode, ErrorCodes } from '../../error-codes';
import type { AnyInputFailure } from '../../failure';
import { databaseUnavailable } from '../../infra-failures';
import { type RetryClass, RETRY_CLASS } from '../../retry-class';

export const completeClassification: Readonly<Record<ErrorCode, RetryClass>> = RETRY_CLASS;

// @ts-expect-error a classification that omits the rest of the taxonomy is not total over ErrorCode
export const incompleteClassification: Readonly<Record<ErrorCode, RetryClass>> = {
  [ErrorCodes.INTERNAL]: 'transient',
};

// @ts-expect-error an infra failure names no field, so its payload cannot reach Problem.errors
export const infraIsNotWireSafe: AnyInputFailure = databaseUnavailable('findById');
