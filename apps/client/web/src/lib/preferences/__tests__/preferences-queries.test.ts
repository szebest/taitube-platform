import { preferencesQueryOptions } from '../preferences-queries';

describe('preferencesQueryOptions', () => {
  it('keys the query under the key the user stream handler refetches', () => {
    expect(preferencesQueryOptions({} as never).queryKey).toEqual(['preferences']);
  });
});
