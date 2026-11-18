type FormatFailureCode =
  | 'FORMAT_UNSUPPORTED_LOCALE'
  | 'FORMAT_UNKNOWN_OPTION'
  | 'FORMAT_WRONG_KIND'
  | 'FORMAT_UNRENDERABLE';

type FailureOf<C extends FormatFailureCode, D extends object> = Readonly<
  { code: C; message: string } & D
>;

export type UnsupportedLocale = FailureOf<'FORMAT_UNSUPPORTED_LOCALE', { locale: string }>;
export type UnknownOption = FailureOf<
  'FORMAT_UNKNOWN_OPTION',
  { formatter: string; option: string }
>;
export type WrongKind = FailureOf<'FORMAT_WRONG_KIND', { formatter: string; received: string }>;
export type Unrenderable = FailureOf<'FORMAT_UNRENDERABLE', { formatter: string; reason: string }>;

export type FormatFailure = UnsupportedLocale | UnknownOption | WrongKind | Unrenderable;

const failure = <C extends FormatFailureCode, D extends object>(
  code: C,
  message: string,
  detail: D
): FailureOf<C, D> => ({ code, message, ...detail });

export const unsupportedLocale = (locale: string): UnsupportedLocale =>
  failure('FORMAT_UNSUPPORTED_LOCALE', `Locale ${locale} is not supported`, { locale });

export const unknownOption = (formatter: string, option: string): UnknownOption =>
  failure('FORMAT_UNKNOWN_OPTION', `${formatter} does not take the option ${option}`, {
    formatter,
    option,
  });

export const wrongKind = (formatter: string, received: string): WrongKind =>
  failure('FORMAT_WRONG_KIND', `${formatter} cannot format a ${received}`, {
    formatter,
    received,
  });

export const unrenderable = (formatter: string, reason: string): Unrenderable =>
  failure('FORMAT_UNRENDERABLE', `${formatter} cannot render: ${reason}`, { formatter, reason });
