const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Drizzle wraps a driver error in a `DrizzleQueryError` and puts the real one on `cause`, so a
 * constraint check has to walk the chain rather than read the top-level object.
 */
function causes(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current = error;
  while (current && typeof current === 'object' && chain.length < 8) {
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

function hasSqlState(error: unknown, state: string): boolean {
  return causes(error).some((link) => (link as { code?: unknown }).code === state);
}

/**
 * PGLite, which the contract suite runs the Postgres adapter against, raises the same error as the
 * `postgres` driver but without the `code` field, so the SQLSTATE alone would classify a duplicate
 * key as a dead connection under test and as a conflict in production. The message is Postgres's
 * own fixed wording and is only consulted when no SQLSTATE is present.
 */
function hasMessage(error: unknown, needle: string): boolean {
  return causes(error).some(
    (link) => typeof (link as { message?: unknown }).message === 'string' &&
      ((link as { message: string }).message).includes(needle)
  );
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    hasSqlState(error, UNIQUE_VIOLATION) ||
    hasMessage(error, 'duplicate key value violates unique constraint')
  );
}

export function isForeignKeyViolation(error: unknown): boolean {
  return (
    hasSqlState(error, FOREIGN_KEY_VIOLATION) ||
    hasMessage(error, 'violates foreign key constraint')
  );
}
