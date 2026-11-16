export type DemoProfile = 'minimal' | 'full';

/** What `pnpm demo seed` and `pnpm demo up` hand the seed; every field has a default in `resolveDemoOptions`. */
export interface DemoOptions {
  profile: DemoProfile;
  /** Videos uploaded through the real pipeline. */
  videos: number;
  users: number;
  channels: number;
  /** Same seed, same world: names, titles, clips, comments, likes. */
  seed: number;
  /** Seed with the worker running (videos reach READY) or only the rows that need no pipeline. */
  withWorker: boolean;
  apiUrl: string;
  /** Directory for generated clips and state, git-ignored (`.demo/`). */
  workDir: string;
  dryRun: boolean;
}

export interface SeedStepReport {
  scenario: string;
  status: 'done' | 'skipped' | 'failed';
  detail: string;
}

export interface SeedReport {
  steps: readonly SeedStepReport[];
}

export interface SeedHost {
  log: (line: string) => void;
  /** `DATABASE_URL`: identities (roles and tiers) are the one thing the seed writes to the database. */
  databaseUrl?: string;
  /** `CDN_BASE_URL`: where the finished videos' HLS is served, checked after the pipeline ran. */
  cdnBaseUrl?: string;
  /**
   * Storage hosts the API signs that this machine cannot reach, mapped to the ones it can
   * (`minio:9000` to `localhost:9000`); the request keeps the signed `Host` header. Defaults to the compose stack's.
   */
  storageAliases?: Readonly<Record<string, string>>;
  /** `NODE_ENV`; the seed refuses `production`. */
  environment?: string;
}
