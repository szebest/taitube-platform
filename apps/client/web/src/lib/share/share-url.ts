export type ShareKind = 'watch' | 'shorts';

interface ShareUrlOptions {
  origin: string;
  /** Seconds in; only a watch link carries it, a short always starts at 0. */
  startAt?: number;
}

/** The public link to a video or a short, which is what every share target receives. */
export function shareUrl(kind: ShareKind, id: string, { origin, startAt = 0 }: ShareUrlOptions) {
  const url = new URL(`/${kind}/${encodeURIComponent(id)}`, origin);
  if (kind === 'watch' && startAt > 0) url.searchParams.set('t', String(Math.floor(startAt)));

  return url.toString();
}
