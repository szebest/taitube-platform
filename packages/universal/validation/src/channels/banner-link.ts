import { type Result, err, ok } from '@vp/result';
import { type InvalidField, invalidField } from '../failures';
import { normalizePlainText, withinLength } from '../plain-text';
import { isHttpsUrl } from './https-url';

export const BANNER_LINK_LIMITS = { maxLabelLength: 24, maxUrlLength: 2048 } as const;

export interface BannerLinkInput {
  readonly label: string;
  readonly url: string;
}

export type InvalidBannerLink = InvalidField<typeof BANNER_LINK_LIMITS>;

/** `null` clears the link; a link comes back trimmed so the caller stores what was validated. */
export function validateBannerLink(
  link: BannerLinkInput | null
): Result<BannerLinkInput | null, InvalidBannerLink> {
  if (link === null) return ok(null);

  const label = normalizePlainText(link.label);
  const url = link.url.trim();
  const fits =
    withinLength(label, { minLength: 1, maxLength: BANNER_LINK_LIMITS.maxLabelLength }) &&
    url.length <= BANNER_LINK_LIMITS.maxUrlLength &&
    isHttpsUrl(url);

  return fits
    ? ok({ label, url })
    : err(
        invalidField(
          'bannerLink',
          `The banner link needs a label of 1 to ${BANNER_LINK_LIMITS.maxLabelLength} characters and an https URL`,
          BANNER_LINK_LIMITS
        )
      );
}
