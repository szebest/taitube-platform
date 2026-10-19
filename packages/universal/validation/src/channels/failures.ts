import { ErrorCodes, type InputFailure } from '@vp/errors';
import { type InvalidField, type LengthBounds, invalidField } from '../failures';

export type InvalidHandleFormat = InputFailure<
  typeof ErrorCodes.INVALID_HANDLE_FORMAT,
  { handle: string; minLength: number; maxLength: number; reserved: boolean }
>;

export function invalidHandleFormat(
  handle: string,
  bounds: LengthBounds,
  reserved = false
): InvalidHandleFormat {
  return {
    code: ErrorCodes.INVALID_HANDLE_FORMAT,
    message: reserved
      ? `Handle "${handle}" is reserved`
      : `Invalid handle format: must be ${bounds.minLength}-${bounds.maxLength} characters matching ^[a-zA-Z0-9_.-]+$`,
    field: 'handle',
    handle,
    minLength: bounds.minLength,
    maxLength: bounds.maxLength,
    reserved,
  };
}

export interface ChannelLinkLimits {
  readonly maxLinks: number;
  readonly maxLabelLength: number;
  readonly maxUrlLength: number;
}

export type InvalidChannelLinks = InvalidField<ChannelLinkLimits>;

export function invalidChannelLinks(limits: ChannelLinkLimits): InvalidChannelLinks {
  return invalidField(
    'links',
    `At most ${limits.maxLinks} links, each with a label of 1 to ${limits.maxLabelLength} characters and an https URL of up to ${limits.maxUrlLength} characters`,
    limits
  );
}
