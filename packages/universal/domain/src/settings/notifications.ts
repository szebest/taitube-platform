import { defineSection, flag, type SectionValues } from './define';

/** Account only: the notification producers read them before they enqueue. */
export const NOTIFICATION_SETTINGS = defineSection({
  subscriptionUploads: flag({ default: true, scope: 'account' }),
  repliesAndMentions: flag({ default: true, scope: 'account' }),
  processingFinished: flag({ default: true, scope: 'account' }),
});

export type NotificationPreferences = SectionValues<typeof NOTIFICATION_SETTINGS>;
