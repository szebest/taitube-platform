import { RENDITIONS } from '../rendition';
import { choice, defineSection, flag, type SectionValues, text } from './define';

export const PLAYBACK_QUALITIES = ['auto', ...RENDITIONS] as const;
export type PlaybackQuality = (typeof PLAYBACK_QUALITIES)[number];

export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export const PLAYBACK_SETTINGS = defineSection({
  quality: choice({ options: PLAYBACK_QUALITIES, default: 'auto', scope: 'both' }),
  speed: choice({ options: PLAYBACK_SPEEDS, default: 1, scope: 'both' }),
  autoplayNext: flag({ default: true, scope: 'both' }),
  hoverPreview: flag({ default: true, scope: 'both' }),
  captionsOn: flag({ default: false, scope: 'both' }),
  /** `null` follows the video's own captions. */
  captionsLanguage: text({ kind: 'languageTag', scope: 'both' }),
  statsOverlay: flag({ default: false, scope: 'both' }),
});

export type PlaybackPreferences = SectionValues<typeof PLAYBACK_SETTINGS>;
