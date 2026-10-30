import { PAGE_SIZE_DEFAULT } from '@vp/pagination';
import { getShorts } from '../shorts';

describe('packages/api-contracts: shorts', () => {
  it('is an anonymous GET /v1/shorts', () => {
    expect(getShorts).toMatchObject({
      method: 'GET',
      path: '/v1/shorts',
      anonymous: true,
      status: 200,
    });
  });

  it('pages by keyset only, with no format or sort to pick', () => {
    expect(getShorts.query.parse({ format: 'standard', sort: 'recent' })).toEqual({
      limit: PAGE_SIZE_DEFAULT,
    });
  });
});
