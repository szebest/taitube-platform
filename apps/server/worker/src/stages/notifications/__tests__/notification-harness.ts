import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NotificationLevel } from '@vp/domain';
import { DEFAULT_PREFERENCES, type NotificationPreferences } from '@vp/domain/settings';
import { createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';

export const CREATOR_ID = '00000000-0000-7000-8000-0000000000c0';
export const CHANNEL_ID = '00000000-0000-7000-8000-0000000000c1';

export const logger = createLogger({
  format: 'json',
  service: 'notifications-spec',
  level: 'silent',
});

export function userId(n: number): string {
  return `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
}

export function videoId(n: number): string {
  return `018f0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
}

export async function seedCreator(repositories: InMemoryRepositories): Promise<void> {
  expectOk(await repositories.users.upsert({ id: CREATOR_ID, email: 'creator@example.com' }));
  expectOk(
    await repositories.channels.create({
      id: CHANNEL_ID,
      userId: CREATOR_ID,
      handle: 'night-kitchen',
      displayName: 'Night Kitchen',
    })
  );
}

export async function seedVideo(
  repositories: InMemoryRepositories,
  id: string,
  overrides: {
    visibility?: 'public' | 'unlisted' | 'private';
    ownerId?: string;
    title?: string;
    deletedAt?: Date;
  } = {}
): Promise<void> {
  expectOk(
    await repositories.videos.create({
      id,
      ownerId: overrides.ownerId ?? CREATOR_ID,
      title: overrides.title ?? `Video ${id.slice(-2)}`,
      sourceKey: `raw/${id}/source.mp4`,
      visibility: overrides.visibility ?? 'public',
      status: 'READY',
      deletedAt: overrides.deletedAt ?? null,
    })
  );
}

export async function seedSubscriber(
  repositories: InMemoryRepositories,
  id: string,
  options: { level?: NotificationLevel; switches?: Partial<NotificationPreferences> } = {}
): Promise<void> {
  expectOk(await repositories.users.upsert({ id, email: `${id}@example.com` }));
  expectOk(await repositories.subscriptions.subscribe(id, CHANNEL_ID));
  if (options.level) {
    expectOk(await repositories.subscriptions.setNotificationLevel(id, CHANNEL_ID, options.level));
  }
  if (options.switches) await saveSwitches(repositories, id, options.switches);
}

export async function saveSwitches(
  repositories: InMemoryRepositories,
  id: string,
  switches: Partial<NotificationPreferences>
): Promise<void> {
  expectOk(
    await repositories.userPreferences.save({
      userId: id,
      preferences: {
        appearance: null,
        playback: null,
        privacy: null,
        notifications: { ...DEFAULT_PREFERENCES.notifications, ...switches },
      },
      expectedVersion: 0,
      sections: ['notifications'],
    })
  );
}

export async function notificationsOf(repositories: InMemoryRepositories, id: string) {
  return expectOk(await repositories.notifications.list(id, { filter: 'all', limit: 50 }));
}
