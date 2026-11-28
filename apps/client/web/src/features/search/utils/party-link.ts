import { isOk, tryCatch } from '@kit/result';
import { WatchPartyIdParamSchema } from '@vp/api-contracts';

const BASE = 'http://party-link.invalid';
const PARTY_PATH = /^\/parties\/([^/]+)\/?$/;

/** The room and invite that a pasted party link, or a bare `/parties/<id>` path, names; `undefined` for any other text. */
export function parsePartyLink(text: string): { roomId: string; invite?: string } | undefined {
  const parsed = tryCatch(
    () => new URL(text.trim(), BASE),
    (cause) => cause
  );
  if (!isOk(parsed)) {
    return undefined;
  }

  const url = parsed.value;
  const roomId = WatchPartyIdParamSchema.shape.id.safeParse(PARTY_PATH.exec(url.pathname)?.[1]);
  if (!roomId.success) {
    return undefined;
  }

  const invite = url.searchParams.get('invite') ?? undefined;
  return invite ? { roomId: roomId.data, invite } : { roomId: roomId.data };
}
