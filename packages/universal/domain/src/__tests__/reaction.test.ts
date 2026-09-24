import { type ReactionType, reactionDelta } from '../reaction';

describe('domain: reaction delta', () => {
  it.each<{
    previous: ReactionType | null;
    next: ReactionType | null;
    likes: number;
    dislikes: number;
  }>([
    { previous: null, next: 'LIKE', likes: 1, dislikes: 0 },
    { previous: null, next: 'DISLIKE', likes: 0, dislikes: 1 },
    { previous: 'LIKE', next: 'DISLIKE', likes: -1, dislikes: 1 },
    { previous: 'DISLIKE', next: 'LIKE', likes: 1, dislikes: -1 },
    { previous: 'LIKE', next: null, likes: -1, dislikes: 0 },
    { previous: 'LIKE', next: 'LIKE', likes: 0, dislikes: 0 },
    { previous: null, next: null, likes: 0, dislikes: 0 },
  ])(
    'moves the counters by $likes/$dislikes from $previous to $next',
    ({ previous, next, likes, dislikes }) => {
      expect(reactionDelta(previous, next)).toEqual({ likes, dislikes });
    }
  );
});
