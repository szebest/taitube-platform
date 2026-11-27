import type { PostPayload } from '@vp/domain';

type PollPayload = Extract<PostPayload, { kind: 'poll' | 'quiz' }>;

export function pollOf(payload: PostPayload): PollPayload | null {
  return payload.kind === 'poll' || payload.kind === 'quiz' ? payload : null;
}

export function isPollClosed(payload: PostPayload, now: Date): boolean {
  const closesAt = pollOf(payload)?.closesAt ?? null;
  return closesAt !== null && new Date(closesAt) <= now;
}
