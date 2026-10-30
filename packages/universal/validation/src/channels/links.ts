import { type Result, err, ok } from '@vp/result';
import { normalizePlainText } from '../plain-text';
import { type ChannelLinkLimits, type InvalidChannelLinks, invalidChannelLinks } from './failures';

const CHANNEL_LINK_LIMITS: ChannelLinkLimits = {
  maxLinks: 5,
  maxLabelLength: 40,
  maxUrlLength: 2048,
};

export interface ChannelLinkInput {
  readonly label: string;
  readonly url: string;
}

function isHttpsUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol, username, password } = new URL(value);
  return protocol === 'https:' && username === '' && password === '';
}

function normalized({ label, url }: ChannelLinkInput): ChannelLinkInput | null {
  const text = normalizePlainText(label);
  const target = url.trim();
  const { maxLabelLength, maxUrlLength } = CHANNEL_LINK_LIMITS;
  const fits =
    Array.from(text).length >= 1 &&
    Array.from(text).length <= maxLabelLength &&
    target.length <= maxUrlLength &&
    isHttpsUrl(target);
  return fits ? { label: text, url: target } : null;
}

/** Labels and URLs come back trimmed, so the caller stores what was validated. */
export function validateChannelLinks(
  links: readonly ChannelLinkInput[]
): Result<ChannelLinkInput[], InvalidChannelLinks> {
  const checked = links.map(normalized);
  const valid = checked.filter((link): link is ChannelLinkInput => link !== null);
  return links.length <= CHANNEL_LINK_LIMITS.maxLinks && valid.length === links.length
    ? ok(valid)
    : err(invalidChannelLinks(CHANNEL_LINK_LIMITS));
}
