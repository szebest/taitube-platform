import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { fileIssueOf, hasCode, reasonCopy } from '../caption-failures';

const problem = (errors: unknown[]) => ({
  type: 't',
  title: 't',
  status: 422,
  detail: 'd',
  code: ErrorCodes.VALIDATION_FAILED,
  instance: 'i',
  errors,
});

describe('apps/client/studio: caption failures', () => {
  it.each([
    { reason: 'NO_AUDIO', copy: 'studio.captionsReasonNoAudio' },
    { reason: 'LANGUAGE_TAKEN', copy: 'studio.captionsReasonLanguageTaken' },
    { reason: ErrorCodes.WHISPER_FAILED, copy: 'errors.whisperFailed' },
    { reason: 'SOMETHING_NEW', copy: 'studio.captionsReasonUnknown' },
    { reason: null, copy: 'studio.captionsReasonUnknown' },
  ])('words the reason $reason as $copy', ({ reason, copy }) => {
    expect(reasonCopy(reason)).toBe(copy);
  });

  it.each([
    {
      scenario: 'the code it was given',
      error: new ApiError(409, ErrorCodes.VERSION_CONFLICT, 'm'),
      is: true,
    },
    { scenario: 'another code', error: new ApiError(409, ErrorCodes.FORBIDDEN, 'm'), is: false },
    { scenario: 'a failure that is no API error', error: new Error('boom'), is: false },
  ])('matches $scenario', ({ error, is }) => {
    expect(hasCode(error, ErrorCodes.VERSION_CONFLICT)).toBe(is);
  });

  it.each([
    {
      scenario: 'the first issue of a refused file',
      error: new ApiError(
        422,
        ErrorCodes.VALIDATION_FAILED,
        'm',
        problem([{ field: 'body', message: 'Line 3: bad', line: 3 }])
      ),
      issue: 'Line 3: bad',
    },
    {
      scenario: 'nothing when the issue names no line',
      error: new ApiError(422, ErrorCodes.VALIDATION_FAILED, 'm', problem([{ message: 'bad' }])),
      issue: undefined,
    },
    {
      scenario: 'nothing for a failure that is no API error',
      error: new Error('boom'),
      issue: undefined,
    },
  ])('reads $scenario', ({ error, issue }) => {
    expect(fileIssueOf(error)).toBe(issue);
  });
});
