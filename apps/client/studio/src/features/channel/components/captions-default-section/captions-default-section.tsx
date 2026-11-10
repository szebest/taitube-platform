import type { OwnerChannel } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { Field, Switch } from '@vp/ui';
import { useState } from 'react';
import { CustomizationSection } from '#app/components/section/customization-section';
import { useSetChannelAutoCaptions } from '#app/features/channel/hooks/use-set-channel-auto-captions';

/** Whether new uploads get generated captions when their own switch follows the channel, saved on its own. */
export function CaptionsDefaultSection({
  channel,
}: {
  channel: Pick<OwnerChannel, 'autoCaptionsDefault'>;
}) {
  const { tOr } = useT();
  const update = useSetChannelAutoCaptions();
  const [enabled, setEnabled] = useState(channel.autoCaptionsDefault);
  const dirty = enabled !== channel.autoCaptionsDefault;

  return (
    <CustomizationSection.Root
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate(enabled);
      }}
    >
      <CustomizationSection.Header>
        <CustomizationSection.Title>
          {tOr('studio.captionsDefaultTitle', {}, '')}
        </CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.captionsDefaultDescription', {}, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        <Field.Root orientation="horizontal">
          <Field.Label>{tOr('studio.captionsDefaultLabel', {}, '')}</Field.Label>
          <Switch
            checked={enabled}
            onCheckedChange={(next) => {
              update.reset();
              setEnabled(next);
            }}
          />
        </Field.Root>
      </CustomizationSection.Body>
      <CustomizationSection.Footer
        saving={update.isPending}
        saved={update.isSuccess && !dirty}
        failure={update.isError ? tOr('studio.sectionNotSaved', {}, '') : undefined}
        disabled={!dirty}
      />
    </CustomizationSection.Root>
  );
}
