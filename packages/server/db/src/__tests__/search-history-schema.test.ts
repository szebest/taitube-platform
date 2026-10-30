import { searchHistory } from '../search-history-schema';
import { referenceFrom } from './foreign-key';

describe('db: search history schema', () => {
  it('lets a deleted user take their searches', () => {
    expect(referenceFrom(searchHistory, 'user_id')).toEqual({
      table: 'users',
      onDelete: 'cascade',
    });
  });
});
