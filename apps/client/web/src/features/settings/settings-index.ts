import type { IconId } from '@vp/ui';

export type SettingsSectionId =
  | 'appearance'
  | 'advanced'
  | 'accessibility'
  | 'playback'
  | 'privacy'
  | 'notifications'
  | 'language';

type SettingsPath =
  | '/settings/appearance'
  | '/settings/appearance/advanced'
  | '/settings/accessibility'
  | '/settings/playback'
  | '/settings/privacy'
  | '/settings/notifications'
  | '/settings/language';

export interface SettingsSectionDefinition {
  to: SettingsPath;
  icon: IconId;
  /** Held on the account alone, so a guest is asked to sign in. */
  account: boolean;
  /** Listed in the section navigation; the rest are reached from another section. */
  inNav: boolean;
  /** The section a page of its own sits under, which its back button returns to. */
  parent?: SettingsSectionId;
}

export const SETTINGS_SECTIONS: Readonly<Record<SettingsSectionId, SettingsSectionDefinition>> = {
  appearance: { to: '/settings/appearance', icon: 'sun', account: false, inNav: true },
  advanced: {
    to: '/settings/appearance/advanced',
    icon: 'layout',
    account: false,
    inNav: false,
    parent: 'appearance',
  },
  accessibility: { to: '/settings/accessibility', icon: 'eye', account: false, inNav: true },
  playback: { to: '/settings/playback', icon: 'play', account: false, inNav: true },
  privacy: { to: '/settings/privacy', icon: 'lock', account: true, inNav: true },
  notifications: { to: '/settings/notifications', icon: 'bell', account: true, inNav: true },
  language: { to: '/settings/language', icon: 'globe', account: false, inNav: true },
};

/** Every section, in the order the navigation and the overview list them. */
export const SETTINGS_SECTION_IDS = Object.keys(SETTINGS_SECTIONS) as SettingsSectionId[];

const row = <const Id extends string>(id: Id, section: SettingsSectionId) => ({ id, section });

/**
 * Every row of every section, by the id its page gives its `SettingItem` and its URL hash. A row
 * is added here and to the catalogue's `settings.rowLabel` and `settings.rowKeywords`, which the
 * typed words in `useSettingsIndex` hold to this list. Search, the command palette and the
 * highlight a result opens all read it.
 */
export const SETTING_ROWS = [
  row('theme', 'appearance'),
  row('mode', 'appearance'),
  row('accent', 'appearance'),
  row('density', 'appearance'),
  row('typography', 'advanced'),
  row('fontSize', 'advanced'),
  row('spacing', 'advanced'),
  row('sizing', 'advanced'),
  row('radius', 'advanced'),
  row('border', 'advanced'),
  row('shadow', 'advanced'),
  row('ambient', 'advanced'),
  row('motion', 'advanced'),
  row('font-size', 'accessibility'),
  row('contrast', 'accessibility'),
  row('reduced-motion', 'accessibility'),
  row('bold-borders', 'accessibility'),
  row('captions', 'accessibility'),
  row('captions-language', 'accessibility'),
  row('quality', 'playback'),
  row('speed', 'playback'),
  row('autoplay-next', 'playback'),
  row('hover-preview', 'playback'),
  row('stats-overlay', 'playback'),
  row('pause-history', 'privacy'),
  row('clear-history', 'privacy'),
  row('hidden-recommendations', 'privacy'),
  row('playlist-visibility', 'privacy'),
  row('subscriptions-visible', 'privacy'),
  row('subscription-uploads', 'notifications'),
  row('replies-and-mentions', 'notifications'),
  row('processing-finished', 'notifications'),
  row('language', 'language'),
];

export type SettingRowId = (typeof SETTING_ROWS)[number]['id'];
