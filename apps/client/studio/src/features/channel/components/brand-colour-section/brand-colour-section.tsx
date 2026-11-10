import type { Channel } from '@vp/api-contracts';
import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { CustomizationSection } from '#app/components/section/customization-section';
import { useChannelValidators } from '#app/features/channel/forms/channel-field-validators';
import { useUpdateChannel } from '#app/features/channel/hooks/use-update-channel';
import { BrandAccentPreview } from '../brand-accent-preview/brand-accent-preview';
import { ChannelTextField } from '../channel-text-field/channel-text-field';

const valuesOf = ({ brandColor }: Pick<Channel, 'brandColor'>) => ({
  brandColor: brandColor ?? '',
});

/** The channel's accent, with what the engine derives from it shown on a dark and a light page, saved on its own. */
export function BrandColourSection({ channel }: { channel: Channel }) {
  const { tOr } = useT();
  const validators = useChannelValidators();
  const update = useUpdateChannel();
  const form = useAppForm({
    defaultValues: valuesOf(channel),
    listeners: { onChange: () => update.reset() },
    onSubmit: ({ value, formApi }) => {
      const brandColor = value.brandColor.trim();
      update.mutate(
        { brandColor: brandColor === '' ? null : brandColor },
        { onSuccess: (saved) => formApi.reset(valuesOf(saved)) }
      );
    },
  });

  return (
    <CustomizationSection.Root
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <CustomizationSection.Header>
        <CustomizationSection.Title>{tOr('studio.brandTitle', {}, '')}</CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.brandDescription', {}, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        <form.AppField name="brandColor" validators={{ onChange: validators.brandColor }}>
          {(field) => (
            <>
              <ChannelTextField
                field={field}
                label={tOr('studio.brandLabel', {}, '')}
                hint={tOr('studio.brandHint', {}, '')}
              />
              {field.state.value.trim() !== '' &&
                validators.brandColor(field.state) === undefined && (
                  <BrandAccentPreview hex={field.state.value.trim()} />
                )}
            </>
          )}
        </form.AppField>
      </CustomizationSection.Body>
      <form.Subscribe selector={({ canSubmit, isDirty }) => ({ canSubmit, isDirty })}>
        {({ canSubmit, isDirty }) => (
          <CustomizationSection.Footer
            saving={update.isPending}
            saved={update.isSuccess && !isDirty}
            failure={update.isError ? tOr('studio.sectionNotSaved', {}, '') : undefined}
            disabled={!(canSubmit && isDirty)}
          />
        )}
      </form.Subscribe>
    </CustomizationSection.Root>
  );
}
