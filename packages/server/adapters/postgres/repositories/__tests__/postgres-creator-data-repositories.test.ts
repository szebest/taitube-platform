import { createCreatorDataRepositories } from '../postgres-creator-data-repositories';
import type { PostgresDatabase } from '../types';

describe('createCreatorDataRepositories', () => {
  it('builds the export, export row, token and account audit repositories over the handle it is given', () => {
    const repositories = createCreatorDataRepositories({} as PostgresDatabase);

    expect(Object.keys(repositories).sort()).toEqual([
      'accountAudit',
      'apiTokens',
      'dataExports',
      'exportRows',
    ]);
  });
});
