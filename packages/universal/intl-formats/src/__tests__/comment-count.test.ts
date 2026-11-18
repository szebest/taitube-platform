import { createIntl } from '@kit/intl';
import { commentCount } from '../comment-count';
import { contextFor } from './fixtures';

describe('@vp/intl-formats: commentCount', () => {
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
