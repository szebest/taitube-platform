import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { views } from '../views';

describe('@vp/intl: views', () => {
  it('is a count value, so the words around it stay in the catalogue', () => {
    expect(views(1_234_567)).toEqual({ type: 'count', value: 1_234_567 });
  });

  it.each([
    { count: 1_234_567, expected: '1.2M' },
    { count: 12_345, expected: '12K' },
    { count: 999, expected: '999' },
  ])('renders $count as $expected in en', ({ count, expected }) => {
    expect(createIntl(contextFor('en')).format(views(count))).toEqual({
      ok: true,
      value: expected,
    });
  });
});
