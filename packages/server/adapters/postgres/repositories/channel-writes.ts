import { channelHandleHistory, channels } from '@vp/db';
import type { UpdateChannelInput } from '@vp/domain';
import { and, eq, ne } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

type ChannelValues = Partial<typeof channels.$inferInsert>;

/** The columns an owner edit sets; the handle is left to `claimHandle`, which has to read the channel first. */
export function channelPatch(input: UpdateChannelInput): ChannelValues {
  const values: ChannelValues = { updatedAt: new Date() };
  if (input.displayName !== undefined) values.displayName = input.displayName;
  if (input.avatarUrl !== undefined) values.avatarUrl = input.avatarUrl;
  if (input.bannerUrl !== undefined) values.bannerUrl = input.bannerUrl;
  if (input.brandColor !== undefined) values.brandColor = input.brandColor;
  if (input.bio !== undefined) values.bio = input.bio;
  if (input.links !== undefined) values.links = input.links;
  if (input.country !== undefined) values.country = input.country;
  if (input.contactEmail !== undefined) values.contactEmail = input.contactEmail;
  if (input.bannerLink !== undefined) values.bannerLink = input.bannerLink;
  return values;
}

/**
 * Takes `handle` for the channel on the caller's transaction: the handle it leaves goes to the
 * history in the same write, and the one it takes leaves the history, so a rolled-back edit
 * retires nothing. A handle another channel holds answers `'taken'`.
 */
export async function claimHandle(
  tx: PostgresDatabase,
  channelId: string,
  handle: string,
  at: Date
): Promise<'taken' | ChannelValues> {
  const [heldByAnother] = await tx
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.handle, handle), ne(channels.id, channelId)))
    .limit(1);
  if (heldByAnother) return 'taken';

  const [current] = await tx
    .select({ handle: channels.handle })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);
  if (!current || current.handle === handle) return { handle };

  await tx.delete(channelHandleHistory).where(eq(channelHandleHistory.handle, handle));
  await tx
    .insert(channelHandleHistory)
    .values({ handle: current.handle, channelId, retiredAt: at })
    .onConflictDoUpdate({
      target: channelHandleHistory.handle,
      set: { channelId, retiredAt: at },
    });
  return { handle, handleChangedAt: at };
}
