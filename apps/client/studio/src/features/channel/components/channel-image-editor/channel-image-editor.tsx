import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { isErr } from '@vp/result';
import {
  CHANNEL_IMAGE_CONTENT_TYPES,
  type ChannelImageKind,
  validateChannelImageDimensions,
} from '@vp/validation';
import { useState } from 'react';
import { ImageCropper, type ImageCropperStatus } from '#app/components/image/image-cropper';
import { validateChannelImageFile } from '#app/features/channel/forms/channel-field-validators';
import {
  type ChannelImageJobStatus,
  useChannelImageUpload,
} from '#app/features/channel/hooks/use-channel-image-upload';
import { useObjectUrl } from '#app/features/channel/hooks/use-object-url';
import { useUpdateChannel } from '#app/features/channel/hooks/use-update-channel';
import { ChannelImage } from '../channel-image/channel-image';
import { readImageSize } from './utils/read-image-size';

const IMAGE_ACCEPT = Object.fromEntries(CHANNEL_IMAGE_CONTENT_TYPES.map((type) => [type, []]));

const CROPPER_STATUS = {
  idle: 'editing',
  working: 'queued',
  ready: 'ready',
  failed: 'failed',
} as const satisfies Record<ChannelImageJobStatus, ImageCropperStatus>;

const STATUS_LABEL = {
  idle: 'studio.cropWorking',
  working: 'studio.cropWorking',
  ready: 'studio.cropReady',
  failed: 'studio.cropFailed',
} as const satisfies Record<ChannelImageJobStatus, string>;

const REMOVAL = { avatar: { avatarUrl: null }, banner: { bannerUrl: null } } as const;

interface Chosen {
  file: File;
  size: { width: number; height: number };
}

interface ChannelImageEditorProps {
  kind: ChannelImageKind;
  currentUrl: string | null;
}

/** One image of the channel: what it is now, a file to choose, its framing in the cropper, and removal. */
export function ChannelImageEditor({ kind, currentUrl }: ChannelImageEditorProps) {
  const { tOr } = useT();
  const upload = useChannelImageUpload(kind);
  const remove = useUpdateChannel();
  const [chosen, setChosen] = useState<Chosen>();
  const [refusal, setRefusal] = useState<string>();
  const src = useObjectUrl(chosen?.file);
  const form = useAppForm({ defaultValues: { file: [] as File[] } });

  const choose = async (file: File | undefined) => {
    setRefusal(undefined);
    if (!file || validateChannelImageFile(kind)({ value: [file] }) !== undefined) return;

    const size = await readImageSize(file);
    if (!size) return setRefusal(tOr('studio.imageUnreadable', {}, ''));

    const fits = validateChannelImageDimensions(kind, size);
    if (isErr(fits)) {
      const { minWidth, minHeight } = fits.error;
      return setRefusal(tOr('studio.imageTooSmall', { minWidth, minHeight }, ''));
    }
    setChosen({ file, size });
  };

  const close = () => {
    setChosen(undefined);
    form.reset();
    if (upload.status !== 'working') upload.reset();
  };

  const labels = {
    avatar: tOr('studio.cropPicture', {}, ''),
    desktop: tOr('studio.cropDesktop', {}, ''),
    mobile: tOr('studio.cropMobile', {}, ''),
    tv: tOr('studio.cropTv', {}, ''),
  };

  return (
    <ChannelImage.Root kind={kind} currentUrl={currentUrl}>
      <form.AppField
        name="file"
        validators={{ onChange: validateChannelImageFile(kind) }}
        listeners={{ onChange: ({ value }) => void choose(value[0]) }}
      >
        {(field) => (
          <field.FileField
            accept={IMAGE_ACCEPT}
            placeholderText={tOr(`studio.${kind}Drop`, {}, '')}
          />
        )}
      </form.AppField>
      {refusal && (
        <p role="alert" className="m-0 text-body-sm text-danger-ink">
          {refusal}
        </p>
      )}
      <p className="m-0 text-body-sm text-fg-muted">{tOr(`studio.${kind}SafeZone`, {}, '')}</p>
      <ChannelImage.Shown />
      <ChannelImage.Remove
        loading={remove.isPending}
        onClick={() => remove.mutate(REMOVAL[kind])}
      />
      {remove.isError && (
        <p role="alert" className="m-0 text-body-sm text-danger-ink">
          {tOr('studio.sectionNotSaved', {}, '')}
        </p>
      )}
      {chosen && src && (
        <ImageCropper.Root
          key={src}
          kind={kind}
          src={src}
          size={chosen.size}
          status={CROPPER_STATUS[upload.status]}
          open
          onOpenChange={(open) => open || close()}
          onConfirm={(crops) => upload.start({ ...chosen, crops })}
        >
          <ImageCropper.Title>
            {tOr(kind === 'avatar' ? 'studio.cropAvatarTitle' : 'studio.cropBannerTitle', {}, '')}
          </ImageCropper.Title>
          <ImageCropper.Description>
            {tOr(
              kind === 'avatar' ? 'studio.cropAvatarDescription' : 'studio.cropBannerDescription',
              {},
              ''
            )}
          </ImageCropper.Description>
          <ImageCropper.Targets aria-label={tOr('studio.cropScreen', {}, '')} labels={labels} />
          <ImageCropper.Stage label={tOr('studio.cropArea', {}, '')} />
          <ImageCropper.Zoom label={tOr('studio.cropZoom', {}, '')} />
          <ImageCropper.Previews labels={labels} />
          <ImageCropper.Status label={tOr(STATUS_LABEL[upload.status], {}, '')} />
          <ImageCropper.Cancel>
            {tOr(upload.status === 'ready' ? 'studio.cropDone' : 'studio.cropCancel', {}, '')}
          </ImageCropper.Cancel>
          <ImageCropper.Confirm>{tOr('studio.cropUse', {}, '')}</ImageCropper.Confirm>
        </ImageCropper.Root>
      )}
    </ChannelImage.Root>
  );
}
