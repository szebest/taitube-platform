import { PostgresApiTokenRepository } from './postgres-api-token-repository';
import { PostgresDataExportRepository } from './postgres-data-export-repository';
import { PostgresExportRowRepository } from './postgres-export-row-repository';
import type { PostgresDatabase } from './types';

/** What a creator takes away or automates: exports, the rows they read, and personal access tokens. */
export function createCreatorDataRepositories(db: PostgresDatabase) {
  return {
    dataExports: new PostgresDataExportRepository(db),
    exportRows: new PostgresExportRowRepository(db),
    apiTokens: new PostgresApiTokenRepository(db),
  };
}

export type CreatorDataRepositories = ReturnType<typeof createCreatorDataRepositories>;
