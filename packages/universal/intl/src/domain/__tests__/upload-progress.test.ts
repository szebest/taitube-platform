import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { uploadProgress } from '../upload-progress';

describe('@vp/intl: uploadProgress', () => {
  it.each([
    { points: 0, expected: '0%' },
    { points: 42.6, expected: '43%' },
    { points: 100, expected: '100%' },
  ])('renders $points percentage points as $expected', ({ points, expected }) => {
    const progress = uploadProgress(points);

    expect(progress.type).toBe('percent');
    expect(createIntl(contextFor('en')).format(progress)).toEqual({ ok: true, value: expected });
  });
});
