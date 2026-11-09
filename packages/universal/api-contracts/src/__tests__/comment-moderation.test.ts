import { CommentActionSchema, moderateComment } from '../comment-moderation';

describe('packages/api-contracts: comment moderation', () => {
  it('serves POST /v1/comments/:id/moderate', () => {
    expect(moderateComment).toMatchObject({ method: 'POST', path: '/v1/comments/:id/moderate' });
  });

  it.each([
    { action: 'hold' },
    { action: 'hold', disclosure: 'visible', reason: 'spam', note: 'twice' },
    { action: 'approve' },
    { action: 'hide', disclosure: 'silent' },
    { action: 'unhide' },
    { action: 'remove', reason: 'off_topic' },
  ])('accepts the action %o', (body) => {
    expect(CommentActionSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    {},
    { action: 'ban' },
    { action: 'hide', disclosure: 'loud' },
    { action: 'remove', reason: 'rude' },
    { action: 'hold', note: 'x'.repeat(201) },
  ])('refuses the action %o', (body) => {
    expect(CommentActionSchema.safeParse(body).success).toBe(false);
  });

  it('promises a conflict for an action the state does not allow', () => {
    expect(moderateComment.errors[409]).toContain('MODERATION_NOT_APPLICABLE');
  });
});
