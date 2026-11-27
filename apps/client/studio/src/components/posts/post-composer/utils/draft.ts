import type { ManagedPostView } from '@vp/api-contracts';
import type { PostDraft, ShareTarget } from '../types';

const MS_PER_SECOND = 1000;
const LOCAL_LENGTH = 16;
const MS_PER_MINUTE = 60_000;

export const EMPTY_DRAFT: PostDraft = {
  kind: 'text',
  text: '',
  caption: '',
  images: [],
  question: '',
  options: ['', ''],
  correctIndex: 0,
  explanation: '',
  closesAt: '',
  video: null,
  playlist: null,
  comment: '',
  startMs: 0,
  commentsEnabled: true,
  timing: 'now',
  publishAt: '',
};

/** An instant as the local `YYYY-MM-DDTHH:mm` the date and time boxes speak. */
export function toLocalInput(iso: string): string {
  const at = new Date(iso);
  const local = new Date(at.getTime() - at.getTimezoneOffset() * MS_PER_MINUTE);
  return local.toISOString().slice(0, LOCAL_LENGTH);
}

/** The instant a complete local `YYYY-MM-DDTHH:mm` names, or undefined while a half is missing. */
export function fromLocalInput(local: string): Date | undefined {
  const [date, time] = local.split('T');
  if (!date || !time) return undefined;
  const at = new Date(local);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

const TIMING_OF = { draft: 'draft', scheduled: 'schedule', published: 'now' } as const;

function targetOf(
  card: Extract<ManagedPostView['body'], { kind: 'video_share' | 'playlist_share' }>['card']
): ShareTarget | null {
  switch (card.type) {
    case 'video':
      return {
        id: card.id,
        title: card.title,
        durationMs: card.durationSeconds === null ? null : card.durationSeconds * MS_PER_SECOND,
      };
    case 'playlist':
      return { id: card.id, title: card.title, durationMs: null };
    case 'unavailable':
      return null;
  }
}

/** What the composer holds to edit `post`: the fields of its kind filled, the rest as a new post has them. */
export function draftOfPost(post: ManagedPostView): PostDraft {
  const { body } = post;
  const base: PostDraft = {
    ...EMPTY_DRAFT,
    kind: body.kind,
    commentsEnabled: post.commentsEnabled,
    timing: TIMING_OF[post.status],
    publishAt: post.publishAt === null ? '' : toLocalInput(post.publishAt),
  };

  switch (body.kind) {
    case 'text':
      return { ...base, text: body.text };
    case 'images':
      return {
        ...base,
        caption: body.caption ?? '',
        images: body.images.map(({ uploadId, alt, urls }) => ({
          key: uploadId,
          fileName: alt,
          previewUrl: urls.w640,
          uploadId,
          alt,
          status: 'ready',
        })),
      };
    case 'poll':
      return {
        ...base,
        question: body.question,
        options: body.options.map(({ text }) => text),
        closesAt: body.closesAt === null ? '' : toLocalInput(body.closesAt),
      };
    case 'quiz':
      return {
        ...base,
        question: body.question,
        options: body.options.map(({ text }) => text),
        closesAt: body.closesAt === null ? '' : toLocalInput(body.closesAt),
        correctIndex: body.correctIndex ?? 0,
        explanation: body.explanation ?? '',
      };
    case 'video_share':
      return {
        ...base,
        video: targetOf(body.card),
        comment: body.comment ?? '',
        startMs: body.startMs ?? 0,
      };
    case 'playlist_share':
      return { ...base, playlist: targetOf(body.card), comment: body.comment ?? '' };
  }
}
