import { createCommentRepositories } from '../postgres-comment-repositories';
import type { PostgresDatabase } from '../types';

describe('createCommentRepositories', () => {
  it('builds one repository for each comment table family over the handle it is given', () => {
    const repositories = createCommentRepositories({} as PostgresDatabase);

    expect(Object.keys(repositories).sort()).toEqual([
      'channelUserRestrictions',
      'commentModeration',
      'commentReports',
      'commentSettings',
      'comments',
      'savedReplies',
      'trustedCommenters',
    ]);
  });
});
