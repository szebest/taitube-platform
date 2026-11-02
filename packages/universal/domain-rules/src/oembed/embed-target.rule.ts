import { type Result, err, ok } from '@vp/result';
import { type OEmbedUrlUnsupported, oembedUrlUnsupported } from './failures';

export interface EmbedTargetInput {
  readonly url: string;
  /** The web app's public origin: only its watch pages are embeddable. */
  readonly webUrl: string;
}

const WATCH_PATH = /^\/watch\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

/** The video a watch-page URL of this site names. A query string or fragment, such as `?t=`, is ignored. */
export function decideEmbedTarget(
  input: EmbedTargetInput
): Result<{ videoId: string }, OEmbedUrlUnsupported> {
  const { url, webUrl } = input;
  if (!(URL.canParse(url) && URL.canParse(webUrl))) return err(oembedUrlUnsupported(url));

  const target = new URL(url);
  const videoId = WATCH_PATH.exec(target.pathname)?.[1];
  if (target.origin !== new URL(webUrl).origin || !videoId) return err(oembedUrlUnsupported(url));

  return ok({ videoId: videoId.toLowerCase() });
}
