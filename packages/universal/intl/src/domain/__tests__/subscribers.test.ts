import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { subscribers } from '../subscribers';

describe('@vp/intl: subscribers', () => {
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
