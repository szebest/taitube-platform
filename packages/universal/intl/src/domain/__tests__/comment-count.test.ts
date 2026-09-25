import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { commentCount } from '../comment-count';

describe('@vp/intl: commentCount', () => {
  it('is a count value', () => {
    expect(commentCount(4_200)).toEqual({ type: 'count', value: 4_200 });
  });

  it('renders compactly', () => {
    expect(createIntl(contextFor('en')).format(commentCount(4_200))).toEqual({
      ok: true,
      value: '4.2K',
    });
  });
});
