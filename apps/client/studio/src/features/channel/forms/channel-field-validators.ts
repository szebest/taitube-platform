import { updateMyChannel } from '@vp/api-contracts';
import { validateBrandColor } from '@vp/domain-rules';
import { validateWith } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { ok } from '@vp/result';
import {
  type ChannelImageKind,
  type ChannelLinkInput,
  validateChannelImageUploadRequest,
  validateBannerLink,
  validateChannelLinks,
  validateContactEmail,
  validateHandle,
} from '@vp/validation';

const { displayName, bio } = updateMyChannel.body.shape;

export const validateHandleField = validateWith(validateHandle);

export const validateContactEmailField = validateWith((email: string) =>
  email.trim() === '' ? ok(email) : validateContactEmail(email.trim())
);

export const validateBannerLinkField = validateWith(
  ({ label, url }: { label: string; url: string }) =>
    label.trim() === '' && url.trim() === ''
      ? ok({ label, url })
      : validateBannerLink({ label: label.trim(), url: url.trim() })
);

export function withoutBlankLinks(links: readonly ChannelLinkInput[]): ChannelLinkInput[] {
  return links.filter(({ label, url }) => label.trim() !== '' || url.trim() !== '');
}

export const validateLinksField = validateWith((links: readonly ChannelLinkInput[]) =>
  validateChannelLinks(withoutBlankLinks(links))
);

export const validateChannelImageFile = (kind: ChannelImageKind) =>
  validateWith(([file]: File[]) =>
    file
      ? validateChannelImageUploadRequest({ kind, contentType: file.type, sizeBytes: file.size })
      : ok(file)
  );

/** The checks the API runs on the fields no shared rule covers, answering this viewer's words. */
export function useChannelValidators() {
  const { tOr } = useT();

  return {
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
  };
}
