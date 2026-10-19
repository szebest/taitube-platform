import { userPreferences } from '../preferences-schema';
import { referenceFrom } from './foreign-key';

describe('db: preferences schema', () => {
  it('lets a deleted user take their preferences', () => {
    expect(referenceFrom(userPreferences, 'user_id')).toEqual({
      table: 'users',
      onDelete: 'cascade',
    });
  });
});
