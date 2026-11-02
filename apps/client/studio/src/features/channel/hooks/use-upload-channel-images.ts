import { useMutation } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import type { ChannelImageKind } from '@vp/validation';

import { uploadChannelImage } from '../api/upload-channel-image';

export type ChannelImageFiles = Partial<Record<ChannelImageKind, File>>;

export type ChannelImageKeys = { avatarKey?: string; bannerKey?: string };

/** Sends each chosen file to storage and answers the keys the channel save takes. */
export function useUploadChannelImages() {
  const api = useApi();

  return useMutation({
    mutationFn: async ({ avatar, banner }: ChannelImageFiles): Promise<ChannelImageKeys> => {
      const [avatarKey, bannerKey] = await Promise.all([
        avatar && uploadChannelImage(api, 'avatar', avatar),
        banner && uploadChannelImage(api, 'banner', banner),
      ]);
      return { ...(avatarKey && { avatarKey }), ...(bannerKey && { bannerKey }) };
    },
  });
}
