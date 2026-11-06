import type { Channel } from '@vp/api-contracts';
import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { CHANNEL_IMAGE_CONTENT_TYPES } from '@vp/validation';
import { validateChannelImageFile } from '#app/features/channel/forms/channel-field-validators';
import { useUpdateChannel } from '#app/features/channel/hooks/use-update-channel';
import { useUploadChannelImages } from '#app/features/channel/hooks/use-upload-channel-images';
import { ChannelImage } from '../channel-image/channel-image';
import { CustomizationSection } from '../customization-section/customization-section';

const IMAGE_ACCEPT = Object.fromEntries(CHANNEL_IMAGE_CONTENT_TYPES.map((type) => [type, []]));

const IMAGE_KINDS = ['avatar', 'banner'] as const;

const REMOVED = { avatar: 'avatarRemoved', banner: 'bannerRemoved' } as const;

const values = {
  avatar: [] as File[],
  banner: [] as File[],
  avatarRemoved: false,
  bannerRemoved: false,
};

/** The channel's picture and banner, uploaded from a file and saved on their own. */
export function BrandingSection({ channel }: { channel: Channel }) {
  const { tOr } = useT();
  const upload = useUploadChannelImages();
  const update = useUpdateChannel();
  const reset = () => {
    upload.reset();
    update.reset();
  };
  const form = useAppForm({
    defaultValues: values,
    listeners: { onChange: reset },
    onSubmit: ({ value, formApi }) => {
      const [avatar] = value.avatar;
      const [banner] = value.banner;
      upload.mutate(
        { ...(avatar && { avatar }), ...(banner && { banner }) },
        {
          onSuccess: (keys) =>
            update.mutate(
              {
                ...keys,
                ...(value.avatarRemoved && !avatar && { avatarUrl: null }),
                ...(value.bannerRemoved && !banner && { bannerUrl: null }),
              },
              { onSuccess: () => formApi.reset(values) }
            ),
        }
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
        <CustomizationSection.Title>
          {tOr('studio.brandingTitle', {}, '')}
        </CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.brandingDescription', {}, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        <form.Subscribe selector={({ values }) => values}>
          {(current) =>
            IMAGE_KINDS.map((kind) => (
              <ChannelImage.Root
                key={kind}
                kind={kind}
                file={current[kind][0]}
                currentUrl={channel[`${kind}Url`] ?? null}
                removed={current[REMOVED[kind]]}
              >
                <form.AppField
                  name={kind}
                  validators={{ onChange: validateChannelImageFile(kind) }}
                  listeners={{ onChange: () => form.setFieldValue(REMOVED[kind], false) }}
                >
                  {(field) => (
                    <field.FileField
                      accept={IMAGE_ACCEPT}
                      placeholderText={tOr(`studio.${kind}Drop`, {}, '')}
                    />
                  )}
                </form.AppField>
                <p className="text-body-sm text-fg-muted">
                  {tOr(`studio.${kind}SafeZone`, {}, '')}
                </p>
                <ChannelImage.Shown />
                <ChannelImage.Remove
                  onClick={() => {
                    form.setFieldValue(kind, []);
                    form.setFieldValue(REMOVED[kind], true);
                  }}
                />
              </ChannelImage.Root>
            ))
          }
        </form.Subscribe>
      </CustomizationSection.Body>
      <form.Subscribe selector={({ canSubmit, isDirty }) => ({ canSubmit, isDirty })}>
        {({ canSubmit, isDirty }) => (
          <CustomizationSection.Footer
            saving={upload.isPending || update.isPending}
            saved={update.isSuccess && !isDirty}
            failure={
              upload.isError || update.isError ? tOr('studio.sectionNotSaved', {}, '') : undefined
            }
            disabled={!(canSubmit && isDirty)}
          />
        )}
      </form.Subscribe>
    </CustomizationSection.Root>
  );
}
