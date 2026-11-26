import { PostgresAccountAuditRepository } from './postgres-account-audit-repository';
import { PostgresApiTokenRepository } from './postgres-api-token-repository';
import { PostgresDataExportRepository } from './postgres-data-export-repository';
import { PostgresExportRowRepository } from './postgres-export-row-repository';
import type { PostgresDatabase } from './types';

/** What an account takes away or automates: exports, the rows they read, personal access tokens, and its own audit log. */
export function createCreatorDataRepositories(db: PostgresDatabase) {
  return {
    dataExports: new PostgresDataExportRepository(db),
    exportRows: new PostgresExportRowRepository(db),
    apiTokens: new PostgresApiTokenRepository(db),
    accountAudit: new PostgresAccountAuditRepository(db),
  };
}

export type CreatorDataRepositories = ReturnType<typeof createCreatorDataRepositories>;
