import { isOk } from '@kit/result';
import { decideEmbedTarget } from '../oembed/embed-target.rule';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PlaylistImportTarget = { type: 'video'; videoId: string } | { type: 'unrecognised' };

/**
 * A bare video id, or a watch page of this site. Any other URL is only recognised as foreign and
 * never fetched, so an import reaches no service but this one.
 */
export function resolvePlaylistImportLine(line: string, webUrl: string): PlaylistImportTarget {
  const text = line.trim();
  if (UUID.test(text)) return { type: 'video', videoId: text.toLowerCase() };
  const target = decideEmbedTarget({ url: text, webUrl });
  return isOk(target) ? { type: 'video', videoId: target.value.videoId } : { type: 'unrecognised' };
}
