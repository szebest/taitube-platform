import { createIntl } from '@kit/intl';
import { subscribers } from '../subscribers';
import { contextFor } from './fixtures';

describe('@vp/intl-formats: subscribers', () => {
  it('is a count value', () => {
    expect(subscribers(12_345)).toEqual({ type: 'count', value: 12_345 });
  });

  it('renders compactly', () => {
    expect(createIntl(contextFor('en')).format(subscribers(12_345))).toEqual({
      ok: true,
      value: '12K',
    });
  });
});
