import { DEFAULT_PLAYLIST_VISIBILITY, type PlaylistVisibility } from './playlist';

export const APPEARANCE_MODES = ['system', 'dark', 'light', 'oled'] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export const CONTRAST_LEVELS = ['standard', 'more'] as const;
export type ContrastLevel = (typeof CONTRAST_LEVELS)[number];

export const PLAYBACK_QUALITIES = [
  'auto',
  '2160p',
  '1440p',
  '1080p',
  '720p',
  '480p',
  '360p',
  '240p',
  '144p',
] as const;
export type PlaybackQuality = (typeof PLAYBACK_QUALITIES)[number];

export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** Theme and token-set ids. The server knows no registry, so any id of this shape is stored. */
export const PREFERENCE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
/** Token group names, camelCase because `fontSize` is one. */
export const TOKEN_GROUP_PATTERN = /^[a-z][a-zA-Z0-9]{0,31}$/;
export const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;
export const MAX_APPEARANCE_OVERRIDES = 16;

export interface AppearancePreferences {
  /** `null` is the app's default theme, which the client's theme registry names. */
  readonly theme: string | null;
  readonly mode: AppearanceMode;
  /** `null` is the theme's own accent. */
  readonly accent: string | null;
  readonly contrast: ContrastLevel;
  /** Token group to set id. */
  readonly overrides: Readonly<Record<string, string>>;
}

export interface PlaybackPreferences {
  readonly quality: PlaybackQuality;
  readonly speed: PlaybackSpeed;
  readonly autoplayNext: boolean;
  readonly hoverPreview: boolean;
  readonly captionsOn: boolean;
  /** BCP 47; `null` follows the video's own captions. */
  readonly captionsLanguage: string | null;
  readonly statsOverlay: boolean;
}

export interface PrivacyPreferences {
  readonly historyPaused: boolean;
  readonly playlistVisibility: PlaylistVisibility;
  readonly subscriptionsVisible: boolean;
}

export interface NotificationPreferences {
  readonly subscriptionUploads: boolean;
  readonly repliesAndMentions: boolean;
  readonly processingFinished: boolean;
}

/** A section is `null` until its first save, and complete from then on. */
export interface Preferences {
  readonly appearance: AppearancePreferences | null;
  readonly playback: PlaybackPreferences | null;
  readonly privacy: PrivacyPreferences | null;
  readonly notifications: NotificationPreferences | null;
}

export type PreferenceSection = keyof Preferences;

/** What a field takes when its section is first saved, or when a patch sets it to `null`. */
export const DEFAULT_PREFERENCES: {
  readonly [S in PreferenceSection]: NonNullable<Preferences[S]>;
} = {
  appearance: { theme: null, mode: 'system', accent: null, contrast: 'standard', overrides: {} },
  playback: {
    quality: 'auto',
    speed: 1,
    autoplayNext: true,
    hoverPreview: true,
    captionsOn: false,
    captionsLanguage: null,
    statsOverlay: false,
  },
  privacy: {
    historyPaused: false,
    playlistVisibility: DEFAULT_PLAYLIST_VISIBILITY,
    subscriptionsVisible: false,
  },
  notifications: { subscriptionUploads: true, repliesAndMentions: true, processingFinished: true },
};

/** Left out keeps the stored value; `null` puts the default back. */
export type SectionPatch<T> = { readonly [K in keyof T]?: T[K] | null };

/** Overrides merge by token group, and a group set to `null` drops its override. */
export type AppearancePatch = Omit<SectionPatch<AppearancePreferences>, 'overrides'> & {
  readonly overrides?: Readonly<Record<string, string | null>> | null;
};

/** A section left out stays as stored; `null` clears the whole section. */
export interface PreferencesPatch {
  readonly appearance?: AppearancePatch | null;
  readonly playback?: SectionPatch<PlaybackPreferences> | null;
  readonly privacy?: SectionPatch<PrivacyPreferences> | null;
  readonly notifications?: SectionPatch<NotificationPreferences> | null;
}

export interface UserPreferences extends Preferences {
  readonly userId: string;
  readonly version: number;
  readonly updatedAt: Date;
}
