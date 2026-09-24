const UNIQUE_VIOLATION = '23505';

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

export function isUniqueViolation(error: unknown): boolean {
  return hasSqlState(error, UNIQUE_VIOLATION);
}
