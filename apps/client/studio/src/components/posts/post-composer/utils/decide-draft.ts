import { type Result, andThen, assertNever, err, ok } from '@kit/result';
import type { PostWriteBody } from '@vp/api-contracts';
import type { PostStatus } from '@vp/domain';
import { decidePollClose, decidePostTiming } from '@vp/domain-rules';
import { validatePostPayload } from '@vp/validation';
import type { PostDraft } from '../types';
import { fromLocalInput } from './draft';

type DraftProblemReason = 'uploading' | 'video' | 'playlist' | 'date' | 'past';

/** What stops a draft: a rule's own sentence, or one of the composer's reasons for the catalogue to word. */
export type DraftProblem =
  | { kind: 'rule'; message: string }
  | { kind: 'own'; reason: DraftProblemReason };

const rule = (message: string): Result<never, DraftProblem> => err({ kind: 'rule', message });
const own = (reason: DraftProblemReason): Result<never, DraftProblem> =>
  err({ kind: 'own', reason });

type Payload = PostWriteBody['payload'];

function rawPayload(draft: PostDraft): Result<Payload, DraftProblem> {
  const closesAt = fromLocalInput(draft.closesAt)?.toISOString() ?? null;
  const optional = (text: string) => text.trim() || null;

  switch (draft.kind) {
    case 'text':
      return ok({ kind: 'text', text: draft.text });
    case 'images': {
      const uploaded = draft.images.flatMap(({ uploadId, alt, status }) =>
        status === 'ready' && uploadId !== null ? [{ uploadId, alt }] : []
      );
      return uploaded.length === draft.images.length
        ? ok({ kind: 'images', images: uploaded, caption: optional(draft.caption) })
        : own('uploading');
    }
    case 'poll':
      return ok({
        kind: 'poll',
        question: draft.question,
        options: [...draft.options],
        closesAt,
      });
    case 'quiz':
      return ok({
        kind: 'quiz',
        question: draft.question,
        options: [...draft.options],
        closesAt,
        correctIndex: draft.correctIndex,
        explanation: optional(draft.explanation),
      });
    case 'video_share':
      return draft.video
        ? ok({
            kind: 'video_share',
            videoId: draft.video.id,
            comment: optional(draft.comment),
            startMs: draft.startMs > 0 ? Math.round(draft.startMs) : null,
          })
        : own('video');
    case 'playlist_share':
      return draft.playlist
        ? ok({
            kind: 'playlist_share',
            playlistId: draft.playlist.id,
            comment: optional(draft.comment),
          })
        : own('playlist');
    default:
      return assertNever(draft.kind, 'PostKind');
  }
}

function timingOf(
  draft: PostDraft,
  now: Date,
  current: PostStatus | null
): Result<PostWriteBody['timing'], DraftProblem> {
  if (draft.timing !== 'schedule') return ok({ mode: draft.timing });

  const publishAt = fromLocalInput(draft.publishAt);
  if (!publishAt) return own('date');
  const decided = decidePostTiming({ current, timing: { mode: 'schedule', publishAt }, now });
  return decided.ok ? ok({ mode: 'schedule', publishAt: publishAt.toISOString() }) : own('past');
}

/**
 * The body the API takes for what the composer holds, every text normalised by the same rules the API
 * applies, or the first thing wrong with it in words.
 */
export function decideDraft(
  draft: PostDraft,
  { now, current }: { now: Date; current: PostStatus | null }
): Result<PostWriteBody, DraftProblem> {
  return andThen(rawPayload(draft), (raw) => {
    const checked = validatePostPayload(raw);
    if (!checked.ok) return rule(checked.error.message);
    const payload = checked.value;

    const closing = decidePollClose(payload, now);
    if (!closing.ok) return rule(closing.error.message);

    return andThen(timingOf(draft, now, current), (timing) =>
      ok({ payload, commentsEnabled: draft.commentsEnabled, timing })
    );
  });
}
