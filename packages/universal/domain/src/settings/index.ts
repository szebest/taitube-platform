import { APPEARANCE_SETTINGS } from './appearance';
import { type SectionValues, sectionDefaults } from './define';
import type { MergePatch } from './merge-patch';
import { NOTIFICATION_SETTINGS } from './notifications';
import { PLAYBACK_SETTINGS } from './playback';
import { PRIVACY_SETTINGS } from './privacy';

export * from './appearance';
export * from './define';
export * from './merge-patch';
export * from './notifications';
export * from './playback';
export * from './privacy';

/** The sections the account stores, and the one definition its contract and rules map over. */
export const PREFERENCE_SECTIONS = {
  appearance: APPEARANCE_SETTINGS,
  playback: PLAYBACK_SETTINGS,
  privacy: PRIVACY_SETTINGS,
  notifications: NOTIFICATION_SETTINGS,
} as const;

export type PreferenceSection = keyof typeof PREFERENCE_SECTIONS;

type SectionOf<S extends PreferenceSection> = SectionValues<(typeof PREFERENCE_SECTIONS)[S]>;

/** A section is `null` until its first save, and complete from then on. */
export type Preferences = { readonly [S in PreferenceSection]: SectionOf<S> | null };

/** What a field takes when its section is first saved, or when a patch sets it to `null`. */
export const DEFAULT_PREFERENCES: { readonly [S in PreferenceSection]: SectionOf<S> } = {
  appearance: sectionDefaults(APPEARANCE_SETTINGS),
  playback: sectionDefaults(PLAYBACK_SETTINGS),
  privacy: sectionDefaults(PRIVACY_SETTINGS),
  notifications: sectionDefaults(NOTIFICATION_SETTINGS),
};

/** A section set to `null` is cleared back to unset. */
export type PreferencesPatch = MergePatch<Preferences>;

export interface UserPreferences extends Preferences {
  readonly userId: string;
  readonly version: number;
  readonly updatedAt: Date;
}
