import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { uploadProgress } from '../upload-progress';

describe('@vp/intl: uploadProgress', () => {
  it.each([
    { uploaded: 0, total: 100, expected: '0%' },
    { uploaded: 1, total: 3, expected: '33%' },
    { uploaded: 100, total: 100, expected: '100%' },
    { uploaded: 0, total: 0, expected: '0%' },
  ])('renders $uploaded of $total bytes as $expected', ({ uploaded, total, expected }) => {
    const progress = uploadProgress(uploaded, total);

    expect(progress.type).toBe('percent');
    expect(createIntl(contextFor('en')).format(progress)).toEqual({ ok: true, value: expected });
  });
});
