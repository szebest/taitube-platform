import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { videoDuration } from '../video-duration';

describe('@vp/intl: videoDuration', () => {
  it('is a clock duration value', () => {
    expect(videoDuration(765)).toEqual({
      type: 'duration',
      value: 765,
      options: { style: 'clock' },
    });
  });

  it.each([
    { seconds: 765, expected: '12:45' },
    { seconds: 3753, expected: '1:02:33' },
  ])('renders $seconds seconds as the $expected badge', ({ seconds, expected }) => {
    expect(createIntl(contextFor('en')).format(videoDuration(seconds))).toEqual({
      ok: true,
      value: expected,
    });
  });
});
