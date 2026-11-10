import { CHANNEL_IMAGE_CONTENT_TYPES, CHANNEL_IMAGE_KINDS } from '../channel-image';

describe('@vp/validation: channel image vocabulary', () => {
  it.each([
    { name: 'the kinds', actual: CHANNEL_IMAGE_KINDS, expected: ['avatar', 'banner'] },
    {
      name: 'the content types',
      actual: CHANNEL_IMAGE_CONTENT_TYPES,
      expected: ['image/jpeg', 'image/png', 'image/webp'],
    },
  ])('names $name an upload may carry', ({ actual, expected }) => {
    expect(actual).toEqual(expected);
  });
});
