import type { Channel } from '@vp/api-contracts';
import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';

import { isImageAddress, useChannelValidators } from '../forms/channel-field-validators';
import { useUpdateChannel } from '../hooks/use-update-channel';
import { ChannelTextField } from './channel-text-field';
import { CustomizationSection } from './customization-section';
import { ImagePreview } from './image-preview';

function valuesOf({ avatarUrl, bannerUrl }: Pick<Channel, 'avatarUrl' | 'bannerUrl'>) {
  return { avatarUrl: avatarUrl ?? '', bannerUrl: bannerUrl ?? '' };
}

const addressOrNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** The channel's picture and banner, by the address of an image the creator hosts, saved on their own. */
export function BrandingSection({ channel }: { channel: Channel }) {
  const { tOr } = useT();
  const validators = useChannelValidators();
  const update = useUpdateChannel();
  const form = useAppForm({
    defaultValues: valuesOf(channel),
    listeners: { onChange: () => update.reset() },
    onSubmit: ({ value, formApi }) =>
      update.mutate(
        { avatarUrl: addressOrNull(value.avatarUrl), bannerUrl: addressOrNull(value.bannerUrl) },
        { onSuccess: (saved) => formApi.reset(valuesOf(saved)) }
      ),
  });

  return (
    <CustomizationSection.Root
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <CustomizationSection.Header>
        <CustomizationSection.Title>
          {tOr('studio.brandingTitle', {}, '')}
        </CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.brandingDescription', {}, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        <form.AppField name="avatarUrl" validators={{ onChange: validators.imageAddress }}>
          {(field) => (
            <>
              <ChannelTextField
                field={field}
                label={tOr('studio.avatarLabel', {}, '')}
                hint={tOr('studio.avatarSafeZone', {}, '')}
              />
              {field.state.value.trim() !== '' && isImageAddress(field.state.value) && (
                <ImagePreview
                  kind="avatar"
                  src={field.state.value.trim()}
                  label={tOr('studio.avatarPreview', {}, '')}
                />
              )}
            </>
          )}
        </form.AppField>
        <form.AppField name="bannerUrl" validators={{ onChange: validators.imageAddress }}>
          {(field) => (
            <>
              <ChannelTextField
                field={field}
                label={tOr('studio.bannerLabel', {}, '')}
                hint={tOr('studio.bannerSafeZone', {}, '')}
              />
              {field.state.value.trim() !== '' && isImageAddress(field.state.value) && (
                <ImagePreview
                  kind="banner"
                  src={field.state.value.trim()}
                  label={tOr('studio.bannerPreview', {}, '')}
                />
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
