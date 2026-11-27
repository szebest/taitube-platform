import { RENDITIONS } from '../rendition';
import { choice, defineSection, flag, type SectionValues, text } from './define';

const PLAYBACK_QUALITIES = ['auto', ...RENDITIONS] as const;

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

const CAPTION_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;

const CAPTION_BACKGROUNDS = ['none', 'translucent', 'solid'] as const;

export const PLAYBACK_SETTINGS = defineSection({
  quality: choice({
    options: PLAYBACK_QUALITIES,
    default: 'auto',
    scope: 'both',
    device: 'storage',
  }),
  speed: choice({ options: PLAYBACK_SPEEDS, default: 1, scope: 'both', device: 'storage' }),
  autoplayNext: flag({ default: true, scope: 'both', device: 'storage' }),
  hoverPreview: flag({ default: true, scope: 'both', device: 'storage' }),
  /** The muted frame preview on a card; off under save-data, 2g and reduced motion whatever this says. */
  hoverPlay: flag({ default: true, scope: 'both', device: 'storage' }),
  captionsOn: flag({ default: false, scope: 'both', device: 'storage' }),
  /** `null` follows the video's own captions. */
  captionsLanguage: text({ kind: 'languageTag', scope: 'both', device: 'storage' }),
  captionsSize: choice({
    options: CAPTION_SIZES,
    default: 'medium',
    scope: 'both',
    device: 'storage',
  }),
  captionsBackground: choice({
    options: CAPTION_BACKGROUNDS,
    default: 'translucent',
    scope: 'both',
    device: 'storage',
  }),
  statsOverlay: flag({ default: false, scope: 'both', device: 'storage' }),
});

export type PlaybackPreferences = SectionValues<typeof PLAYBACK_SETTINGS>;
