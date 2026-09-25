import { ErrorCodes } from '@vp/errors';
import { assertNever } from '@vp/result';
import {
  type FormatFailure,
  describeCause,
  unknownOption,
  unrenderable,
  unsupportedLocale,
  wrongKind,
} from '../failures';

function subjectOf(failure: FormatFailure): string {
  switch (failure.code) {
    case ErrorCodes.FORMAT_UNSUPPORTED_LOCALE:
      return failure.locale;
    case ErrorCodes.FORMAT_UNKNOWN_OPTION:
      return failure.option;
    case ErrorCodes.FORMAT_WRONG_KIND:
      return failure.received;
    case ErrorCodes.FORMAT_UNRENDERABLE:
      return failure.reason;
    default:
      return assertNever(failure, 'subjectOf');
  }
}

describe('@vp/intl: format failures', () => {
  it.each([
    { failure: unsupportedLocale('xx'), code: 'FORMAT_UNSUPPORTED_LOCALE', subject: 'xx' },
    { failure: unknownOption('date', 'stlye'), code: 'FORMAT_UNKNOWN_OPTION', subject: 'stlye' },
    { failure: wrongKind('date', 'number'), code: 'FORMAT_WRONG_KIND', subject: 'number' },
    {
      failure: unrenderable('money', 'no currency'),
      code: 'FORMAT_UNRENDERABLE',
      subject: 'no currency',
    },
  ])('carries $code and narrows to its own detail', ({ failure, code, subject }) => {
    expect(failure.code).toBe(code);
    expect(subjectOf(failure)).toBe(subject);
    expect(failure.message).toContain(subject);
  });

  it.each([
    {
      cause: new RangeError('Incorrect locale information provided'),
      expected: 'Incorrect locale information provided',
    },
    { cause: 'thrown text', expected: 'thrown text' },
  ])('describes a thrown $cause', ({ cause, expected }) => {
    expect(describeCause(cause)).toBe(expected);
  });
});
