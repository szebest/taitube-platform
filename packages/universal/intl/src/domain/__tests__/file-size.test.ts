import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { fileSize } from '../file-size';

describe('@vp/intl: fileSize', () => {
  it('is a decimal bytes value', () => {
    expect(fileSize(5_000_000_000)).toEqual({
      type: 'bytes',
      value: 5_000_000_000,
      options: { base: 'decimal' },
    });
  });

  it('renders the upload ceiling as 5 GB', () => {
    expect(createIntl(contextFor('en')).format(fileSize(5_000_000_000))).toEqual({
      ok: true,
      value: '5 GB',
    });
  });
});
