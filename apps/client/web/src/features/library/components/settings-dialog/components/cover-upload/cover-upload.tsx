import { readImageSize, useAppForm, validateWith } from '@kit/forms';
import { isErr, ok } from '@kit/result';
import {
  CHANNEL_IMAGE_CONTENT_TYPES,
  validateChannelImageDimensions,
  validateChannelImageUploadRequest,
} from '@vp/validation';
import { useState } from 'react';
import {
  type CoverUploadStatus,
  usePlaylistCoverUpload,
} from '#app/features/library/hooks/use-playlist-cover-upload';
import { useT } from '#app/lib/messages';

const KIND = 'playlist-cover';

const IMAGE_ACCEPT = Object.fromEntries(CHANNEL_IMAGE_CONTENT_TYPES.map((type) => [type, []]));

const NOTICE = {
  idle: null,
  working: { role: 'status', key: 'playlistTools.coverUploading', tone: 'text-fg-muted' },
  ready: null,
  failed: { role: 'alert', key: 'playlistTools.coverUploadFailed', tone: 'text-danger-ink' },
} as const satisfies Record<
  CoverUploadStatus,
  { role: 'status' | 'alert'; key: string; tone: string } | null
>;

const validateCoverFile = validateWith(([file]: File[]) =>
  file
    ? validateChannelImageUploadRequest({
        kind: KIND,
        contentType: file.type,
        sizeBytes: file.size,
      })
    : ok(file)
);

export interface CoverUploadProps {
  playlistId: string;
}

/** An image of the owner's own as the cover, its middle 16:9 kept, shown once its job is done. */
export function CoverUpload({ playlistId }: CoverUploadProps) {
  const { tOr } = useT();
  const upload = usePlaylistCoverUpload(playlistId);
  const [refusal, setRefusal] = useState<string>();
  const form = useAppForm({ defaultValues: { file: [] as File[] } });
  const notice = NOTICE[upload.status];

  const choose = async (file: File | undefined) => {
    setRefusal(undefined);
    if (!file || validateCoverFile({ value: [file] }) !== undefined) {
      return;
    }

    const size = await readImageSize(file);
    if (!size) {
      setRefusal(tOr('playlistTools.coverUnreadable', {}, ''));
      return;
    }

    const fits = validateChannelImageDimensions(KIND, size);
    if (isErr(fits)) {
      const { minWidth, minHeight } = fits.error;
      setRefusal(tOr('playlistTools.coverTooSmall', { minWidth, minHeight }, ''));
      return;
    }
    upload.start({ file, size });
  };

  return (
    <div className="flex flex-col gap-1">
      <form.AppField
        name="file"
        validators={{ onChange: validateCoverFile }}
        listeners={{ onChange: ({ value }) => void choose(value[0]) }}
      >
        {(field) => (
          <field.FileField
            accept={IMAGE_ACCEPT}
            placeholderText={tOr('playlistTools.coverDrop', {}, '')}
            selectedText={(count) => tOr('playlistTools.coverSelected', { count }, '')}
          />
        )}
      </form.AppField>
      <p className="m-0 text-caption text-fg-muted">{tOr('playlistTools.coverHint', {}, '')}</p>
      {refusal !== undefined ? (
        <p role="alert" className="m-0 text-caption text-danger-ink">
          {refusal}
        </p>
      ) : (
        notice && (
          <p role={notice.role} className={`m-0 text-caption ${notice.tone}`}>
            {tOr(notice.key, {}, '')}
          </p>
        )
      )}
    </div>
  );
}
