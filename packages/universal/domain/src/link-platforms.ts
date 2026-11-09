export const LINK_PLATFORMS = [
  'website',
  'github',
  'x',
  'instagram',
  'tiktok',
  'twitch',
  'discord',
  'mastodon',
  'bluesky',
  'linkedin',
  'reddit',
  'facebook',
] as const;

export type LinkPlatform = (typeof LINK_PLATFORMS)[number];

const HOSTS: Readonly<Record<Exclude<LinkPlatform, 'website'>, readonly string[]>> = {
  github: ['github.com'],
  x: ['x.com', 'twitter.com'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  twitch: ['twitch.tv'],
  discord: ['discord.com', 'discord.gg'],
  mastodon: ['mastodon.social', 'mastodon.online', 'mstdn.social', 'fosstodon.org', 'hachyderm.io'],
  bluesky: ['bsky.app'],
  linkedin: ['linkedin.com'],
  reddit: ['reddit.com'],
  facebook: ['facebook.com', 'fb.com'],
};

const HOST_ENTRIES = Object.entries(HOSTS) as [LinkPlatform, readonly string[]][];

/** A host belongs to a platform when it is one of its domains or a subdomain of one. */
export function platformOfUrl(url: string): LinkPlatform {
  if (!URL.canParse(url)) return 'website';
  const host = new URL(url).hostname.toLowerCase();
  const found = HOST_ENTRIES.find(([, domains]) =>
    domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
  );
  return found ? found[0] : 'website';
}
