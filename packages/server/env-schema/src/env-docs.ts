import type { AppEnvKey, EnvKeyDoc } from './env-doc';
import { CORE_DOCS, POSTGRES_DOCS, REDIS_DOCS } from './env-docs-core';
import { LIVE_DOCS, OBSERVABILITY_DOCS, WATCH_PARTY_DOCS } from './env-docs-live-observability';
import { PIPELINE_DOCS } from './env-docs-pipeline';
import { AUTH_DOCS, STORAGE_DOCS } from './env-docs-storage-auth';

/**
 * Compiles only when `docs` has an entry for every `AppEnvKey` and for no other key: a schema key
 * added without an entry, or an entry for a key the schema lacks, is a type error here.
 */
function defineEnvDocs<const T extends Record<AppEnvKey, EnvKeyDoc>>(
  docs: T & Record<Exclude<keyof T, AppEnvKey>, never>
): Record<AppEnvKey, EnvKeyDoc> {
  return docs;
}

export const ENV_DOCS = defineEnvDocs({
  ...CORE_DOCS,
  ...POSTGRES_DOCS,
  ...REDIS_DOCS,
  ...STORAGE_DOCS,
  ...AUTH_DOCS,
  ...PIPELINE_DOCS,
  ...LIVE_DOCS,
  ...WATCH_PARTY_DOCS,
  ...OBSERVABILITY_DOCS,
});
