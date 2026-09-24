import { type ApiErrorCode, ApiErrorCodes } from './api-error-codes';
import { type PipelineErrorCode, PipelineErrorCodes } from './pipeline-error-codes';

export const ErrorCodes = { ...ApiErrorCodes, ...PipelineErrorCodes } as const;

export type ErrorCode = ApiErrorCode | PipelineErrorCode;
