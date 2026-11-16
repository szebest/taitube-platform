import { createCreatorDataRepositories } from '../postgres-creator-data-repositories';
import type { PostgresDatabase } from '../types';

describe('createCreatorDataRepositories', () => {
  it('builds the export, export row and token repositories over the handle it is given', () => {
    const repositories = createCreatorDataRepositories({} as PostgresDatabase);

    expect(Object.keys(repositories).sort()).toEqual(['apiTokens', 'dataExports', 'exportRows']);
  });
});
