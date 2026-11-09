import { COMMENT_MODERATION_REASONS } from '../comment-moderation';
import { COMMENT_REPORT_REASONS } from '../comment-report';

describe('@vp/domain: comment moderation reasons', () => {
  it('is the report reasons plus off_topic', () => {
    expect(COMMENT_MODERATION_REASONS).toEqual([...COMMENT_REPORT_REASONS, 'off_topic']);
  });
});
