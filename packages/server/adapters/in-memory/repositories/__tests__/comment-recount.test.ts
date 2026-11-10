import type { PublicScopeContext } from '../comment-public-scope';
import { recountAuthored } from '../comment-recount';
import type { StoredComment } from '../comment-visibility';
import { aStoredComment } from './stored-comment';

describe('adapters/in-memory: recountAuthored', () => {
  it('counts again only the videos the user commented on, from what an anonymous reader sees', () => {
    const rows = [
      aStoredComment({ id: 'c1', videoId: 'v1', authorId: 'user' }),
      aStoredComment({ id: 'c2', videoId: 'v1', authorId: 'other' }),
      aStoredComment({ id: 'c3', videoId: 'v1', authorId: 'other', moderationState: 'held' }),
      aStoredComment({ id: 'c4', videoId: 'v2', authorId: 'other' }),
    ];
    const comments = new Map<string, StoredComment>(rows.map((row) => [row.id, row]));
    const videos = [
      { id: 'v1', commentsCount: 3 },
      { id: 'v2', commentsCount: 9 },
    ];
    const scope: PublicScopeContext = {
      comments,
      shadowed: new Map([['v1', new Set(['user'])]]),
    };

    const touched = recountAuthored(comments, videos, 'user', scope);

    expect(touched).toEqual(['v1']);
    expect(videos).toEqual([
      { id: 'v1', commentsCount: 1 },
      { id: 'v2', commentsCount: 9 },
    ]);
  });
});
