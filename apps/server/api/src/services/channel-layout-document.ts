import { ChannelLayoutSchema } from '@vp/api-contracts';
import { type ChannelLayout, migrateLayout } from '@vp/domain';

export function readStoredLayout(raw: unknown): ChannelLayout | null {
  const migrated = migrateLayout(raw);
  if (migrated === null) return null;
  const parsed = ChannelLayoutSchema.safeParse(migrated);
  return parsed.success ? parsed.data : null;
}
