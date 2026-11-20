import type { AnyInputFailure, RetryClass } from '@kit/errors';
import { type ErrorCode, ErrorCodes } from '../../error-codes';
import { databaseUnavailable } from '../../infra-failures';
import { RETRY_CLASS } from '../../retry-class';

const _completeClassification: Readonly<Record<ErrorCode, RetryClass>> = RETRY_CLASS;

// @ts-expect-error a classification that omits the rest of the taxonomy is not total over ErrorCode
const _incompleteClassification: Readonly<Record<ErrorCode, RetryClass>> = {
  [ErrorCodes.INTERNAL]: 'transient',
};

// @ts-expect-error an infra failure names no field, so its payload cannot reach Problem.errors
const _infraIsNotWireSafe: AnyInputFailure = databaseUnavailable('findById');
