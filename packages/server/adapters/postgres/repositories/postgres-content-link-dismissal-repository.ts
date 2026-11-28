import { fromPromise, map, type Result } from '@kit/result';
import type { ContentLinkDismissalRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { eq } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { contentLinkDismissals: d } = schema;

export class PostgresContentLinkDismissalRepository implements ContentLinkDismissalRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async dismiss(
    channelId: string,
    suggestionKey: string,
    dismissedBy: string
  ): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () =>
        this.db.insert(d).values({ channelId, suggestionKey, dismissedBy }).onConflictDoNothing(),
      databaseUnavailable.during('dismissLinkSuggestion')
    );
    return map(written, () => undefined);
  }

  async dismissedKeys(channelId: string): Promise<Result<Set<string>, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select({ key: d.suggestionKey }).from(d).where(eq(d.channelId, channelId)),
      databaseUnavailable.during('listDismissedLinkSuggestions')
    );
    return map(rows, (found) => new Set(found.map(({ key }) => key)));
  }
}
