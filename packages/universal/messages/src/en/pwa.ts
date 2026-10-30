import { dt } from '../define';

export const pwa = {
  installTitle: dt('Install Taitube'),
  installBody: dt('Add Taitube to your device to open it like an app.'),
  installAction: dt('Install'),
  installDismiss: dt('Not now'),
  updateTitle: dt('A new version of Taitube is ready'),
  updateAction: dt('Reload to update'),
  offlineTitle: dt('You are offline'),
  offlineDescription: dt(
    'The feed you already loaded still works. The rest returns with your connection.'
  ),
  offlineBannerDescription: dt('The feed you already loaded still works.'),
  offlineToastTitle: dt('You are offline'),
  offlineToastDescription: dt('The feed you already loaded stays available.'),
  offlineFeed: dt('Feed'),
  offlineFeedCount: dt('{count:plural}', {
    plural: { count: { one: '{?} page', other: '{?} pages' } },
  }),
  offlineQueuedChanges: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} change will sync when the connection returns.',
        other: '{?} changes will sync when the connection returns.',
      },
    },
  }),
  offlineHome: dt('Go to Home'),
  saveOffline: dt('Save for offline'),
  savedOffline: dt('Saved for offline'),
  saveOfflineDone: dt('Saved for offline'),
  saveOfflineRemoved: dt('Removed from offline'),
  saveOfflineFailed: dt('This video could not be saved for offline.'),
  saveOfflineQuota: dt('There is not enough storage on this device to save this video.'),
  saveOfflineUnavailable: dt('This video has no version that can be saved yet.'),
  saveOfflineLimit: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} video is saved already. Remove it to save another.',
        other: '{?} videos are saved already. Remove one to save another.',
      },
    },
  }),
} as const;
