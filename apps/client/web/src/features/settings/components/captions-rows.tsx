import { useT } from '@vp/intl-react';
import { Select, Switch } from '@vp/ui';

import { usePlaybackPreference } from '../device/device-preferences-provider';
import { SettingItem } from './setting-item';

const CAPTION_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ja', 'ko'] as const;

const VIDEO_OWN = 'auto';

export function CaptionsRow() {
  const [captionsOn, setCaptionsOn] = usePlaybackPreference('captionsOn');
  const { tOr } = useT();

  return (
    <SettingItem
      row="captions"
      setting="playback.captionsOn"
      description={tOr('settings.rowDescription', { row: 'captions' }, '')}
    >
      <Switch
        aria-label={tOr('settings.rowLabel', { row: 'captions' }, '')}
        checked={captionsOn}
        onCheckedChange={setCaptionsOn}
      />
    </SettingItem>
  );
}

/** The language captions start in; a tag the account saved that the list lacks stays chosen, worded as the tag. */
export function CaptionsLanguageRow() {
  const [language, setLanguage] = usePlaybackPreference('captionsLanguage');
  const { tOr } = useT();
  const unlisted = language !== null && !CAPTION_LANGUAGES.some((listed) => listed === language);

  return (
    <SettingItem
      row="captions-language"
      setting="playback.captionsLanguage"
      description={tOr('settings.rowDescription', { row: 'captions-language' }, '')}
    >
      <Select.Root
        value={language ?? VIDEO_OWN}
        onValueChange={(next) => setLanguage(next === VIDEO_OWN ? null : next)}
      >
        <Select.Trigger aria-label={tOr('settings.rowLabel', { row: 'captions-language' }, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={VIDEO_OWN}>
            {tOr('settings.captionLanguage', { language: VIDEO_OWN }, '')}
          </Select.Item>
          {CAPTION_LANGUAGES.map((tag) => (
            <Select.Item key={tag} value={tag}>
              {tOr('settings.captionLanguage', { language: tag }, '')}
            </Select.Item>
          ))}
          {unlisted && <Select.Item value={language}>{language}</Select.Item>}
        </Select.Content>
      </Select.Root>
    </SettingItem>
  );
}
