import type { UserRole, UserTier } from '@vp/domain';
import { type Result, fromPromise, isErr, ok } from '@vp/result';
import { type Log, createDbClient, waitForDatabase } from './client';
import { users } from './schema';

export interface SeedIdentity {
  id: string;
  email: string;
  tier: UserTier;
  role: UserRole;
}

/** Roles and tiers cannot be granted through the public API, so a demo world writes them here. */
export async function upsertIdentities(
  connectionUrl: string,
  identities: readonly SeedIdentity[],
  log: Log,
  wait: { attempts?: number; delayMs?: number } = {}
): Promise<Result<number, Error>> {
  const { db, sql } = createDbClient(connectionUrl, { max: 2 });
  try {
    const reached = await waitForDatabase(() => sql`SELECT 1`, {
      label: 'db:identities',
      log,
      ...wait,
    });
    if (isErr(reached)) return reached;

    for (const identity of identities) {
      const { id, ...fields } = identity;
      const written = await fromPromise(
        () =>
          db.insert(users).values(identity).onConflictDoUpdate({ target: users.id, set: fields }),
        (cause) => new Error(`upserting identity ${id} failed`, { cause })
      );
      if (isErr(written)) return written;
    }
    return ok(identities.length);
  } finally {
    await sql.end();
  }
}
