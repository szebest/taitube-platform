export type Stored = Readonly<Record<string, unknown>>;

/** One version to the next: pure, so each is tested alone. Step `n` (from 0) takes version `n + 1` to `n + 2`. */
export type MigrationStep = (stored: Stored) => Stored;

export type Migrated = Readonly<{
  stored: Stored;
  /** The stored version was newer than this code knows: the fields it understands are read, nothing is rewritten. */
  newer: boolean;
}>;

function isStored(value: unknown): value is Stored {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @internal */
export const currentVersion = (steps: readonly MigrationStep[]): number => steps.length + 1;

/** Runs every step from the stored version up to the current one; stored data that is no object is empty at version 1. */
export function migrate(raw: unknown, steps: readonly MigrationStep[]): Migrated {
  const current = currentVersion(steps);
  const stored: Stored = isStored(raw) ? raw : {};
  const version = typeof stored.schema === 'number' ? stored.schema : 1;

  if (version > current) {
    return { stored, newer: true };
  }

  let migrated = stored;
  for (const step of steps.slice(Math.max(version, 1) - 1)) {
    migrated = step(migrated);
  }
  return { stored: { ...migrated, schema: current }, newer: false };
}

/** The cookie: version 2 holds the locale alone, the playback fields moved to `localStorage`. */
export const COOKIE_MIGRATIONS: readonly MigrationStep[] = [
  ({ schema: _schema, playback, locale }) => ({ locale, legacyPlayback: playback }),
];

/** `localStorage`: version 1 is where it started. */
export const STORAGE_MIGRATIONS: readonly MigrationStep[] = [];
