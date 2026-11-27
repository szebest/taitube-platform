const SLUG_MAX = 40;

/** A branch name or PR reference as a DNS-1123 label fragment: `feat/Add_Player` and `pr-326` stay readable. */
export function previewSlug(ref: string): string {
  const slug = ref
    .toLowerCase()
    .replace(/^refs\/(heads|pull)\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
  return slug === '' ? 'preview' : slug;
}

export function resolveNamespace(pattern: string, slug: string | undefined): string | undefined {
  if (!pattern.includes('{slug}')) return pattern;
  return slug === undefined ? undefined : pattern.replace('{slug}', previewSlug(slug));
}

export function expiresAt(now: Date, ttlHours: number): string {
  return new Date(now.getTime() + ttlHours * 3_600_000).toISOString();
}

export interface PreviewNamespace {
  name: string;
  expiresAt: string | undefined;
}

/** A preview with no valid expiry annotation counts as expired: an unlabelled one is a leak, not a keeper. */
export function expiredPreviews(namespaces: readonly PreviewNamespace[], now: Date): string[] {
  return namespaces
    .filter((namespace) => {
      const expiry = Date.parse(namespace.expiresAt ?? '');
      return Number.isNaN(expiry) || expiry <= now.getTime();
    })
    .map((namespace) => namespace.name)
    .sort();
}
