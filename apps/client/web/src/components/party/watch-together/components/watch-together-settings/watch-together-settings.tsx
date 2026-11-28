import { useAppForm } from '@kit/forms';
import { Button, DateTimePicker, Field, Label, Switch } from '@kit/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { WatchPartyView } from '@vp/api-contracts';
import { WATCH_PARTY_PRESETS, WATCH_PARTY_VISIBILITIES, type WatchPartyPreset } from '@vp/domain';
import { useT } from '#app/lib/messages';
import { quickWatchPartyKey, type PartyHost } from '../../hooks/use-quick-watch-party';
import { useUpdateWatchParty } from '../../hooks/use-update-watch-party';
import type { WatchTogetherSource } from '../../types';

const NO_PRESET = 'keep';
const ACCENT = /^#[0-9a-fA-F]{6}$/;

export interface WatchTogetherSettingsProps {
  room: WatchPartyView;
  source: WatchTogetherSource;
  hostAs: PartyHost;
}

function localOf(iso: string | null): string {
  if (iso === null) {
    return '';
  }
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** The "Room settings" disclosure: the room's name, who can find it and join, its schedule and accent, saved in one go. */
export function WatchTogetherSettings({ room, source, hostAs }: WatchTogetherSettingsProps) {
  const { tOr } = useT();
  const client = useQueryClient();
  const update = useUpdateWatchParty(room);

  const form = useAppForm({
    defaultValues: {
      name: room.name,
      visibility: room.visibility,
      password: '',
      capacity: room.capacity === null ? '' : String(room.capacity),
      allowGuests: room.allowGuests,
      preset: NO_PRESET as WatchPartyPreset | typeof NO_PRESET,
      scheduledFor: localOf(room.scheduledFor),
      accent: room.accent ?? '',
    },
    onSubmit: async ({ value }) => {
      const preset = WATCH_PARTY_PRESETS.find((candidate) => candidate === value.preset);
      const updated = await update.mutateAsync({
        preset,
        settings: {
          name: value.name,
          visibility: value.visibility,
          ...(value.password === '' ? {} : { password: value.password }),
          capacity: value.capacity === '' ? null : Number(value.capacity),
          allowGuests: value.allowGuests,
          scheduledFor:
            value.scheduledFor === '' ? null : new Date(value.scheduledFor).toISOString(),
          accent: ACCENT.test(value.accent) ? value.accent : null,
        },
      });
      client.setQueryData(quickWatchPartyKey(source, hostAs), updated);
    },
  });

  return (
    <details className="flex min-w-0 flex-col gap-inline">
      <summary className="cursor-pointer text-label">{tOr('party.settingsTitle', {}, '')}</summary>
      <form
        className="mt-inline flex flex-col gap-stack"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.AppField name="name">
          {(field) => <field.TextField label={tOr('party.settingsName', {}, '')} />}
        </form.AppField>
        <form.AppField name="visibility">
          {(field) => (
            <field.SelectField
              label={tOr('party.settingsVisibility', {}, '')}
              options={WATCH_PARTY_VISIBILITIES}
              labelOf={(visibility) => tOr('videos.visibility', { visibility }, '')}
            />
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => <field.TextField label={tOr('party.settingsPassword', {}, '')} />}
        </form.AppField>
        <form.AppField name="capacity">
          {(field) => <field.TextField label={tOr('party.settingsCapacity', {}, '')} />}
        </form.AppField>
        <form.Field name="allowGuests">
          {(field) => (
            <Label className="flex items-center gap-inline">
              <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
              {tOr('party.settingsGuests', {}, '')}
            </Label>
          )}
        </form.Field>
        <form.AppField name="preset">
          {(field) => (
            <field.SelectField
              label={tOr('party.settingsPreset', {}, '')}
              options={[NO_PRESET, ...WATCH_PARTY_PRESETS]}
              labelOf={(preset) =>
                preset === NO_PRESET
                  ? tOr('party.settingsPresetKeep', {}, '')
                  : tOr('party.roleEditorPresetName', { preset }, '')
              }
            />
          )}
        </form.AppField>
        <Link
          to="/parties/$roomId"
          params={{ roomId: room.id }}
          search={{}}
          className="text-body-sm"
        >
          {tOr('party.settingsRoleEditor', {}, '')}
        </Link>
        <form.Field name="scheduledFor">
          {(field) => (
            <Field.Root>
              <Field.Label>{tOr('party.settingsSchedule', {}, '')}</Field.Label>
              <DateTimePicker
                value={field.state.value}
                onValueChange={field.handleChange}
                dateLabel={tOr('party.settingsScheduleDate', {}, '')}
                timeLabel={tOr('party.settingsScheduleTime', {}, '')}
              />
            </Field.Root>
          )}
        </form.Field>
        <form.AppField name="accent">
          {(field) => <field.TextField label={tOr('party.settingsAccent', {}, '')} />}
        </form.AppField>
        <Button type="submit" variant="solid" loading={update.isPending}>
          {tOr('party.settingsSave', {}, '')}
        </Button>
      </form>
    </details>
  );
}
