import type { CommentSettingsView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { Field, Select, Switch } from '@vp/ui';
import { useSettingsSection } from '#app/features/comments/hooks/use-settings-section';
import { SettingsSection } from '../settings-section/settings-section';

const SLOW_MODES = ['off', '5', '10', '30', '60', '300'] as const;

const AGES = ['0', '1', '3', '7', '14', '30'] as const;

const SLOW_KEYS = ['slowModeSeconds'] as const;
const SUBSCRIBER_KEYS = ['subscribersOnly'] as const;
const AGE_KEYS = ['minAccountAgeDays'] as const;

type SectionProps = { settings: CommentSettingsView };

export function SlowModeSection({ settings }: SectionProps) {
  const { tOr } = useT();
  const section = useSettingsSection(settings, SLOW_KEYS);
  const seconds = section.draft.slowModeSeconds;

  return (
    <SettingsSection
      title={tOr('studio.settingsSlowTitle', {}, '')}
      description={tOr('studio.settingsSlowDescription', {}, '')}
      section={section}
    >
      <Field.Root>
        <Field.Label>{tOr('studio.settingsSlowLabel', {}, '')}</Field.Label>
        <Select.Root
          value={seconds === null ? 'off' : String(seconds)}
          onValueChange={(next) =>
            section.change({ slowModeSeconds: next === 'off' ? null : Number(next) })
          }
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {SLOW_MODES.map((option) => (
              <Select.Item key={option} value={option}>
                {tOr('studio.settingsSlowOption', { seconds: option }, '')}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Field.Root>
    </SettingsSection>
  );
}

export function SubscribersOnlySection({ settings }: SectionProps) {
  const { tOr } = useT();
  const section = useSettingsSection(settings, SUBSCRIBER_KEYS);

  return (
    <SettingsSection
      title={tOr('studio.settingsSubscribersTitle', {}, '')}
      description={tOr('studio.settingsSubscribersDescription', {}, '')}
      section={section}
    >
      <Field.Root orientation="horizontal">
        <Field.Label>{tOr('studio.settingsSubscribersLabel', {}, '')}</Field.Label>
        <Switch
          checked={section.draft.subscribersOnly}
          onCheckedChange={(subscribersOnly) => section.change({ subscribersOnly })}
        />
      </Field.Root>
    </SettingsSection>
  );
}

export function AccountAgeSection({ settings }: SectionProps) {
  const { tOr } = useT();
  const section = useSettingsSection(settings, AGE_KEYS);

  return (
    <SettingsSection
      title={tOr('studio.settingsAgeTitle', {}, '')}
      description={tOr('studio.settingsAgeDescription', {}, '')}
      section={section}
    >
      <Field.Root>
        <Field.Label>{tOr('studio.settingsAgeLabel', {}, '')}</Field.Label>
        <Select.Root
          value={String(section.draft.minAccountAgeDays)}
          onValueChange={(next) => section.change({ minAccountAgeDays: Number(next) })}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {AGES.map((option) => (
              <Select.Item key={option} value={option}>
                {tOr('studio.settingsAgeOption', { days: option }, '')}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Field.Root>
    </SettingsSection>
  );
}
