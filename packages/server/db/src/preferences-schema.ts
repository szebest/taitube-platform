import type {
  AppearancePreferences,
  NotificationPreferences,
  PlaybackPreferences,
  PrivacyPreferences,
} from '@vp/domain/settings';
import { integer, jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users } from './schema';

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  appearance: jsonb('appearance').$type<AppearancePreferences>(),
  playback: jsonb('playback').$type<PlaybackPreferences>(),
  privacy: jsonb('privacy').$type<PrivacyPreferences>(),
  notifications: jsonb('notifications').$type<NotificationPreferences>(),
  version: integer('version').notNull().default(1),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
