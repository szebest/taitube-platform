import { type ApiErrorCode, ApiErrorCodes } from './api-error-codes.js';
import { type PipelineErrorCode, PipelineErrorCodes } from './pipeline-error-codes.js';

export const ErrorCodes = { ...ApiErrorCodes, ...PipelineErrorCodes } as const;

export type ErrorCode = ApiErrorCode | PipelineErrorCode;
