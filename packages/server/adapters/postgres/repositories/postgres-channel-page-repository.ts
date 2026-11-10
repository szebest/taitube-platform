import type { ChannelPageRepositoryPort } from '@vp/core/repositories';
import { channelLocalizations as loc, channelPageSettings as page } from '@vp/db';
import type { ChannelLocalization, ChannelPageSettings } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { asc, eq } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

export class PostgresChannelPageRepository implements ChannelPageRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async getSettings(channelId: string): Promise<Result<ChannelPageSettings, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ trailerVideoId: page.trailerVideoId, returningVideoId: page.returningVideoId })
          .from(page)
          .where(eq(page.channelId, channelId))
          .limit(1),
      databaseUnavailable.during('getChannelPageSettings')
    );
    return map(rows, ([row]) => row ?? { trailerVideoId: null, returningVideoId: null });
  }

  async listLocalizations(
    channelId: string
  ): Promise<Result<ChannelLocalization[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select({
            locale: loc.locale,
            description: loc.description,
            trailerVideoId: loc.trailerVideoId,
          })
          .from(loc)
          .where(eq(loc.channelId, channelId))
          .orderBy(asc(loc.locale)),
      databaseUnavailable.during('listChannelLocalizations')
    );
  }

  async replace(
    channelId: string,
    settings: ChannelPageSettings,
    localizations: readonly ChannelLocalization[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx
            .insert(page)
            .values({ channelId, ...settings })
            .onConflictDoUpdate({
              target: page.channelId,
              set: { ...settings, updatedAt: new Date() },
            });
          await tx.delete(loc).where(eq(loc.channelId, channelId));
          if (localizations.length === 0) return;
          await tx.insert(loc).values(localizations.map((row) => ({ channelId, ...row })));
        }),
      databaseUnavailable.during('replaceChannelPage')
    );
    return map(written, () => undefined);
  }
}
