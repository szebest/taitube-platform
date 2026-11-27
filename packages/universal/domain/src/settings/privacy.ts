import { DEFAULT_PLAYLIST_VISIBILITY, PLAYLIST_VISIBILITIES } from '../playlist';
import { choice, defineSection, flag, type SectionValues } from './define';

/** Account only: the server acts on these, so a device copy could disagree with what it does. */
export const PRIVACY_SETTINGS = defineSection({
  historyPaused: flag({ default: false, scope: 'account' }),
  playlistVisibility: choice({
    options: PLAYLIST_VISIBILITIES,
    default: DEFAULT_PLAYLIST_VISIBILITY,
    scope: 'account',
  }),
  subscriptionsVisible: flag({ default: false, scope: 'account' }),
  /** "Show me in party previews and on Discord": `toRosterPreview` shows a face only when it is on. */
  showInParties: flag({ default: true, scope: 'account' }),
});

export type PrivacyPreferences = SectionValues<typeof PRIVACY_SETTINGS>;
