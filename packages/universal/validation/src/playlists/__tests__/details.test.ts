import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { validatePlaylistDetails } from '../details';

describe('@vp/validation: validatePlaylistDetails', () => {
  it.each([
    { name: 'a plain title', input: { title: 'Road trip' }, normalized: { title: 'Road trip' } },
    {
      name: 'a padded title and description',
      input: { title: '  Road trip ', description: ' songs \n' },
      normalized: { title: 'Road trip', description: 'songs' },
    },
    { name: 'control characters', input: { title: 'Mi\u0000x' }, normalized: { title: 'Mix' } },
    { name: 'an empty description', input: { description: '' }, normalized: { description: '' } },
    {
      name: 'the title ceiling in emoji',
      input: { title: '🎵'.repeat(150) },
      normalized: { title: '🎵'.repeat(150) },
    },
    { name: 'no field at all', input: {}, normalized: {} },
  ])('accepts $name', ({ input, normalized }) => {
    const result = validatePlaylistDetails(input);

    expect(isOk(result) && result.value).toEqual(normalized);
  });

  it.each([
    { name: 'a blank title', input: { title: '   ' }, field: 'title' },
    { name: 'a title over 150 characters', input: { title: 'a'.repeat(151) }, field: 'title' },
    {
      name: 'a description over 5000 characters',
      input: { description: 'a'.repeat(5001) },
      field: 'description',
    },
  ])('rejects $name', ({ input, field }) => {
    const result = validatePlaylistDetails(input);

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field,
    });
  });
});
