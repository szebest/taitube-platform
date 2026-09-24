import { CREDENTIAL_HEADERS } from '../credentials';

describe('@vp/logger: credentials', () => {
  it('names every header that carries a credential in lower case, as Node reports it', () => {
    expect([...CREDENTIAL_HEADERS]).toEqual(['authorization', 'cookie', 'x-admin-token']);
  });
});
