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
  offlineHome: dt('Go to Home'),
} as const;
