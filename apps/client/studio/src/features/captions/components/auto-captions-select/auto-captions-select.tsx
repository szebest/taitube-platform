import { useMutation } from '@tanstack/react-query';
import type { CaptionListView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Field, Select, useToast } from '@vp/ui';
import { autoCaptionsMutationOptions } from '#app/features/captions/api/caption-mutations';

type Switch = 'on' | 'off' | 'follow';

const VALUES = { on: true, off: false, follow: null } as const satisfies Record<
  Switch,
  boolean | null
>;

function switchOf(autoCaptions: boolean | null): Switch {
  if (autoCaptions === null) return 'follow';
  return autoCaptions ? 'on' : 'off';
}

function isSwitch(value: string): value is Switch {
  return Object.keys(VALUES).includes(value);
}

export interface AutoCaptionsSelectProps {
  videoId: string;
  settings: NonNullable<CaptionListView['settings']>;
}

/** On, off, or follow the channel: the one switch that decides whether this video is captioned by speech-to-text. */
export function AutoCaptionsSelect({ videoId, settings }: AutoCaptionsSelectProps) {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const update = useMutation(autoCaptionsMutationOptions(api, videoId));

  const labels: Record<Switch, string> = {
    on: tOr('studio.captionsAutoOn', {}, ''),
    off: tOr('studio.captionsAutoOff', {}, ''),
    follow: settings.channelDefault
      ? tOr('studio.captionsAutoFollowOn', {}, '')
      : tOr('studio.captionsAutoFollowOff', {}, ''),
  };

  return (
    <Field.Root>
      <Field.Label>{tOr('studio.captionsAutoLabel', {}, '')}</Field.Label>
      <Select.Root
        value={switchOf(settings.autoCaptions)}
        disabled={update.isPending}
        onValueChange={(next) => {
          if (!isSwitch(next)) return;
          update.mutate(VALUES[next], {
            onError: () =>
              toast({ tone: 'danger', title: tOr('studio.captionsSettingsFailed', {}, '') }),
          });
        }}
      >
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {Object.entries(labels).map(([value, label]) => (
            <Select.Item key={value} value={value}>
              {label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Field.Root>
  );
}
