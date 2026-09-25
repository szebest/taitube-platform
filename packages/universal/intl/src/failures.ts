import { ErrorCodes, type Failure } from '@vp/errors';

export type UnsupportedLocale = Failure<
  typeof ErrorCodes.FORMAT_UNSUPPORTED_LOCALE,
  { locale: string }
>;
export type UnknownOption = Failure<
  typeof ErrorCodes.FORMAT_UNKNOWN_OPTION,
  { formatter: string; option: string }
>;
export type WrongKind = Failure<
  typeof ErrorCodes.FORMAT_WRONG_KIND,
  { formatter: string; received: string }
>;
export type Unrenderable = Failure<
  typeof ErrorCodes.FORMAT_UNRENDERABLE,
  { formatter: string; reason: string }
>;

export type FormatFailure = UnsupportedLocale | UnknownOption | WrongKind | Unrenderable;

export function unsupportedLocale(locale: string): UnsupportedLocale {
  return {
    code: ErrorCodes.FORMAT_UNSUPPORTED_LOCALE,
    message: `Locale ${locale} is not supported`,
    locale,
  };
}

export function unknownOption(formatter: string, option: string): UnknownOption {
  return {
    code: ErrorCodes.FORMAT_UNKNOWN_OPTION,
    message: `${formatter} does not take the option ${option}`,
    formatter,
    option,
  };
}

export function wrongKind(formatter: string, received: string): WrongKind {
  return {
    code: ErrorCodes.FORMAT_WRONG_KIND,
    message: `${formatter} cannot format a ${received}`,
    formatter,
    received,
  };
}

export function unrenderable(formatter: string, reason: string): Unrenderable {
  return {
    code: ErrorCodes.FORMAT_UNRENDERABLE,
    message: `${formatter} cannot render: ${reason}`,
    formatter,
    reason,
  };
}
