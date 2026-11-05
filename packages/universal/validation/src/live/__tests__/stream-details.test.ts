import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { validateLiveStreamDetails } from '../stream-details';

describe('@vp/validation: validateLiveStreamDetails', () => {
  it.each([
    { name: 'nothing', input: {}, details: {} },
    { name: 'an empty title', input: { title: '' }, details: { title: '' } },
    {
      name: 'padded text',
      input: { title: '  Speedrun ', description: ' Any%\n' },
      details: { title: 'Speedrun', description: 'Any%' },
    },
  ])('accepts $name', ({ input, details }) => {
    expect(expectOk(validateLiveStreamDetails(input))).toEqual(details);
  });

  it.each([
    { field: 'title', input: { title: 'a'.repeat(101) }, maxLength: 100 },
    { field: 'description', input: { description: 'a'.repeat(5001) }, maxLength: 5000 },
  ])('rejects a $field over $maxLength characters', ({ field, input, maxLength }) => {
    expect(expectErr(validateLiveStreamDetails(input))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field,
      maxLength,
    });
  });
});
