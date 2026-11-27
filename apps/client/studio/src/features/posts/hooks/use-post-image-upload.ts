import { fromPromise, isErr } from '@kit/result';
import { useApi, useUserEvent } from '@vp/queries';
import { validateChannelImageDimensions, validateChannelImageUploadRequest } from '@vp/validation';
import { useEffect, useRef, useState } from 'react';
import type { DraftUpdate, ImageDraft } from '#app/components/posts/post-composer';
import { useT } from '#app/lib/messages';
import { readImageSize } from '#app/utils/read-image-size';
import { uploadChannelImage } from '#app/utils/upload-channel-image';

/**
 * Takes the files the creator chose into the draft as pictures: each is checked, previewed at once,
 * uploaded to the channel's `post-image` store and counted ready when the user event says so.
 */
export function usePostImageUpload(update: (update: DraftUpdate) => void) {
  const api = useApi();
  const { tOr } = useT();
  const [refusal, setRefusal] = useState<string>();
  const keyOfUpload = useRef(new Map<string, string>());
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const held = previews.current;
    return () => {
      for (const url of held) URL.revokeObjectURL(url);
    };
  }, []);

  const patch = (key: string, next: Partial<ImageDraft>) =>
    update((draft) => ({
      ...draft,
      images: draft.images.map((image) => (image.key === key ? { ...image, ...next } : image)),
    }));

  useUserEvent('channel.image.ready', ({ payload }) => {
    const key = keyOfUpload.current.get(payload.uploadId);
    if (key) patch(key, { status: 'ready' });
  });

  useUserEvent('channel.image.failed', ({ payload }) => {
    const key = keyOfUpload.current.get(payload.uploadId);
    if (key) patch(key, { status: 'failed' });
  });

  const addFile = async (file: File) => {
    const request = validateChannelImageUploadRequest({
      kind: 'post-image',
      contentType: file.type,
      sizeBytes: file.size,
    });
    if (isErr(request)) return setRefusal(request.error.message);

    const size = await readImageSize(file);
    if (!size) return setRefusal(tOr('studio.imageUnreadable', {}, ''));

    const fits = validateChannelImageDimensions('post-image', size);
    if (isErr(fits)) {
      const { minWidth, minHeight } = fits.error;
      return setRefusal(tOr('studio.imageTooSmall', { minWidth, minHeight }, ''));
    }

    const key = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    previews.current.add(previewUrl);
    const image: ImageDraft = {
      key,
      fileName: file.name,
      previewUrl,
      uploadId: null,
      alt: '',
      status: 'uploading',
    };
    update((draft) => ({ ...draft, images: [...draft.images, image] }));

    const uploaded = await fromPromise(
      () =>
        uploadChannelImage(
          api,
          {
            kind: 'post-image',
            file,
            size,
            crops: { kind: 'post-image', crop: { x: 0, y: 0, ...size } },
          },
          (uploadId) => {
            keyOfUpload.current.set(uploadId, key);
            patch(key, { uploadId });
          }
        ),
      (cause) => cause
    );
    if (isErr(uploaded)) patch(key, { status: 'failed' });
  };

  return {
    refusal,
    add: (files: File[]) => {
      setRefusal(undefined);
      for (const file of files) void addFile(file);
    },
  };
}
