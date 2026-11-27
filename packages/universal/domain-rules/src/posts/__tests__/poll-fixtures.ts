import type { ChannelPost, PostPayload } from '@vp/domain';
import { aPost } from '../../__tests__/entities';

export const NOW = new Date('2026-03-01T12:00:00.000Z');

export function aPoll(over: { closesAt?: string | null } = {}): PostPayload {
  return {
    kind: 'poll',
    question: 'Best?',
    options: ['a', 'b', 'c'],
    closesAt: over.closesAt ?? null,
  };
}

export function aQuiz(over: { closesAt?: string | null; correctIndex?: number } = {}): PostPayload {
  return {
    kind: 'quiz',
    question: 'Best?',
    options: ['a', 'b', 'c'],
    closesAt: over.closesAt ?? null,
    correctIndex: over.correctIndex ?? 1,
    explanation: 'Because',
  };
}

export function postOf(payload: PostPayload): ChannelPost {
  return aPost({ payload });
}
