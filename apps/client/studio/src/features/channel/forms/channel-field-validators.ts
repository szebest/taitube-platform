import { updateMyChannel } from '@vp/api-contracts';
import { validateWith } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { type ChannelLinkInput, validateChannelLinks, validateHandle } from '@vp/validation';
import { useMemo } from 'react';

const { displayName, bio } = updateMyChannel.body.shape;

export const validateHandleField = validateWith(validateHandle);

export function withoutBlankLinks(links: readonly ChannelLinkInput[]): ChannelLinkInput[] {
  return links.filter(({ label, url }) => label.trim() !== '' || url.trim() !== '');
}

export const validateLinksField = validateWith((links: readonly ChannelLinkInput[]) =>
  validateChannelLinks(withoutBlankLinks(links))
);

export function isImageAddress(value: string): boolean {
  const address = value.trim();
  return address === '' || (URL.canParse(address) && new URL(address).protocol === 'https:');
}

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
      imageAddress: ({ value }: { value: string }) =>
        isImageAddress(value) ? undefined : tOr('studio.imageInvalid', {}, ''),
    }),
    [tOr]
  );
}
