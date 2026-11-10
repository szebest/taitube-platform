import { COMMENT_REMOVAL_EXCERPT_LENGTH, COMMENT_REMOVAL_RETENTION_DAYS } from '../comment-removal';

describe('@vp/domain: comment removal', () => {
  it('keeps 200 characters of the text for 30 days', () => {
    expect([COMMENT_REMOVAL_EXCERPT_LENGTH, COMMENT_REMOVAL_RETENTION_DAYS]).toEqual([200, 30]);
  });
});
