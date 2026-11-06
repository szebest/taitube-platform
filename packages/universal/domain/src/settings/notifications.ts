import { choice, defineSection, flag, type SectionValues } from './define';

export const WATCH_PARTY_INVITE_SOURCES = ['everyone', 'subscriptions', 'nobody'] as const;

/** Account only: the notification producers read them before they enqueue. */
export const NOTIFICATION_SETTINGS = defineSection({
  subscriptionUploads: flag({ default: true, scope: 'account' }),
  repliesAndMentions: flag({ default: true, scope: 'account' }),
  processingFinished: flag({ default: true, scope: 'account' }),
  watchParties: flag({ default: true, scope: 'account' }),
  /** Who may invite this account to a party: `subscriptions` is people whose channel it subscribes to. */
  watchPartyInvites: choice({
    options: WATCH_PARTY_INVITE_SOURCES,
    default: 'everyone',
    scope: 'account',
  }),
});

export type NotificationPreferences = SectionValues<typeof NOTIFICATION_SETTINGS>;
