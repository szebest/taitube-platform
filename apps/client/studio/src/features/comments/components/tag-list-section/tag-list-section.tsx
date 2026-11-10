import type { CommentSettingsView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { Field, TagInput } from '@vp/ui';
import { useSettingsSection } from '#app/features/comments/hooks/use-settings-section';
import { SettingsSection } from '../settings-section/settings-section';

const LISTS = {
  blockedWords: {
    max: 200,
    title: 'studio.settingsBlockedTitle',
    description: 'studio.settingsBlockedDescription',
    label: 'studio.settingsBlockedLabel',
    placeholder: 'studio.settingsBlockedPlaceholder',
  },
  linkAllowlist: {
    max: 50,
    title: 'studio.settingsAllowlistTitle',
    description: 'studio.settingsAllowlistDescription',
    label: 'studio.settingsAllowlistLabel',
    placeholder: 'studio.settingsAllowlistPlaceholder',
  },
} as const;

export type TagListField = keyof typeof LISTS;

export interface TagListSectionProps {
  settings: CommentSettingsView;
  field: TagListField;
}

const FIELDS = { blockedWords: ['blockedWords'], linkAllowlist: ['linkAllowlist'] } as const;

/** The blocked words, or the allowed sites: a list of short values with paste-a-list. */
export function TagListSection({ settings, field }: TagListSectionProps) {
  const { tOr } = useT();
  const list = LISTS[field];
  const section = useSettingsSection(settings, FIELDS[field]);

  return (
    <SettingsSection
      title={tOr(list.title, {}, '')}
      description={tOr(list.description, {}, '')}
      section={section}
    >
      <Field.Root>
        <Field.Label>{tOr(list.label, {}, '')}</Field.Label>
        <TagInput
          value={section.draft[field] ?? []}
          max={list.max}
          placeholder={tOr(list.placeholder, {}, '')}
          onValueChange={(tags) => section.change({ [field]: tags })}
        />
      </Field.Root>
    </SettingsSection>
  );
}
