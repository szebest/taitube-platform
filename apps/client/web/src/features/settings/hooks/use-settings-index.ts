import { useT } from '@vp/intl-react';

import {
  SETTING_ROWS,
  SETTINGS_SECTIONS,
  type SettingRowId,
  type SettingsSectionId,
} from '../settings-index';

export interface SettingsIndexEntry {
  id: SettingRowId;
  section: SettingsSectionId;
  /** The page the row is on; its hash is `id`. */
  to: (typeof SETTINGS_SECTIONS)[SettingsSectionId]['to'];
  label: string;
  keywords: string;
  sectionTitle: string;
}

/** Every setting, worded for the viewer: what the overview's search and the command palette list. */
export function useSettingsIndex(): SettingsIndexEntry[] {
  const { tOr } = useT();

  return SETTING_ROWS.map(({ id, section }) => ({
    id,
    section,
    to: SETTINGS_SECTIONS[section].to,
    label: tOr('settings.rowLabel', { row: id }, ''),
    keywords: tOr('settings.rowKeywords', { row: id }, ''),
    sectionTitle: tOr('settings.sectionTitle', { section }, ''),
  }));
}
