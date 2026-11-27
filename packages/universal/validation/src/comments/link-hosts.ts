const CANDIDATE =
  /(?:https?:\/\/|www\.)[^\s<>"]+|(?<![\p{L}\p{N}@./-])(?:[\p{L}\p{N}-]+\.)+[a-z]{2,24}(?![\p{L}\p{N}])(?:\/[^\s<>"]*)?/giu;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;
const HAS_SCHEME = /^https?:\/\//i;

function hostOf(candidate: string): string | null {
  const trimmed = candidate.replace(TRAILING_PUNCTUATION, '');
  const target = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!URL.canParse(target)) return null;
  return new URL(target).hostname.replace(/\.$/, '').toLowerCase();
}

/** @internal An allowed host admits itself and every subdomain of it. */
export function isAllowedHost(host: string, allowlist: readonly string[]): boolean {
  const lowered = host.toLowerCase();
  return allowlist.some((allowed) => lowered === allowed || lowered.endsWith(`.${allowed}`));
}

export function hasLinkOutsideAllowlist(text: string, allowlist: readonly string[]): boolean {
  return Array.from(text.matchAll(CANDIDATE), ([candidate]) => hostOf(candidate)).some(
    (host) => host !== null && !isAllowedHost(host, allowlist)
  );
}
