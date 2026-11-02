import { type Result, err, ok } from '@vp/result';
import { type OEmbedFormatUnsupported, oembedFormatUnsupported } from './failures';

/** The oEmbed spec lets a provider answer a format it does not serve with 501. */
export function decideEmbedFormat(format: string): Result<'json', OEmbedFormatUnsupported> {
  return format === 'json' ? ok('json') : err(oembedFormatUnsupported(format));
}
