import { updateMyChannel } from '@vp/api-contracts';
import { validateBrandColor } from '@vp/domain-rules';
import { validateWith } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { ok } from '@vp/result';
import {
  type ChannelImageKind,
  type ChannelLinkInput,
  validateChannelImage,
  validateChannelLinks,
  validateHandle,
} from '@vp/validation';
import { useMemo } from 'react';

const { displayName, bio } = updateMyChannel.body.shape;

export const validateHandleField = validateWith(validateHandle);

export function withoutBlankLinks(links: readonly ChannelLinkInput[]): ChannelLinkInput[] {
  return links.filter(({ label, url }) => label.trim() !== '' || url.trim() !== '');
}

export const validateLinksField = validateWith((links: readonly ChannelLinkInput[]) =>
  validateChannelLinks(withoutBlankLinks(links))
);

export const validateChannelImageFile = (kind: ChannelImageKind) =>
  validateWith(([file]: File[]) =>
    file ? validateChannelImage({ kind, contentType: file.type, sizeBytes: file.size }) : ok(file)
  );

/** The checks the API runs on the fields no shared rule covers, answering this viewer's words. */
export function useChannelValidators() {
  const { tOr } = useT();

  return useMemo(
    () => ({
      displayName: ({ value }: { value: string }) =>
        displayName.safeParse(value.trim()).success
          ? undefined
          : tOr('studio.displayNameInvalid', {}, ''),
      bio: ({ value }: { value: string }) =>
        bio.safeParse(value).success ? undefined : tOr('studio.bioInvalid', {}, ''),
      brandColor: ({ value }: { value: string }) =>
        value.trim() === '' || validateBrandColor(value.trim()).ok
          ? undefined
          : tOr('studio.brandInvalid', {}, ''),
    }),
    [tOr]
  );
}
