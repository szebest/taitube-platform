import { PLAYBACK_SETTINGS } from '@vp/domain/settings';
import { useT } from '@vp/intl-react';
import { Select, Switch } from '@vp/ui';
import { usePlaybackPreference } from '../device-preferences-provider/device-preferences-provider';
import { SettingItem } from '../setting-item/setting-item';

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

interface CaptionsStyleRowProps<Option extends string> {
  row: 'captions-size' | 'captions-background';
  setting: `playback.${'captionsSize' | 'captionsBackground'}`;
  value: Option;
  options: readonly Option[];
  onPick: (option: Option) => void;
  optionLabel: (option: Option) => string;
}

function CaptionsStyleRow<Option extends string>({
  row,
  setting,
  value,
  options,
  onPick,
  optionLabel,
}: CaptionsStyleRowProps<Option>) {
  const { tOr } = useT();

  return (
    <SettingItem
      row={row}
      setting={setting}
      description={tOr('settings.rowDescription', { row }, '')}
    >
      <Select.Root
        value={value}
        onValueChange={(next) => {
          const picked = options.find((option) => option === next);
          if (picked) onPick(picked);
        }}
      >
        <Select.Trigger aria-label={tOr('settings.rowLabel', { row }, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option} value={option}>
              {optionLabel(option)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </SettingItem>
  );
}

export function CaptionsSizeRow() {
  const [size, setSize] = usePlaybackPreference('captionsSize');
  const { tOr } = useT();

  return (
    <CaptionsStyleRow
      row="captions-size"
      setting="playback.captionsSize"
      value={size}
      options={PLAYBACK_SETTINGS.captionsSize.options}
      onPick={setSize}
      optionLabel={(option) => tOr('player.captionSizeOption', { size: option }, '')}
    />
  );
}

export function CaptionsBackgroundRow() {
  const [background, setBackground] = usePlaybackPreference('captionsBackground');
  const { tOr } = useT();

  return (
    <CaptionsStyleRow
      row="captions-background"
      setting="playback.captionsBackground"
      value={background}
      options={PLAYBACK_SETTINGS.captionsBackground.options}
      onPick={setBackground}
      optionLabel={(option) => tOr('player.captionBackgroundOption', { background: option }, '')}
    />
  );
}
