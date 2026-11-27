import { ownOrPublicScope, publicCommentScope } from '../public-comment';
import { sqlParams, sqlText } from './sql-text';

describe('adapters/postgres: public comment scope', () => {
  it('admits published comments of authors no shadow ban hides, and nothing else, to a stranger', () => {
    const text = sqlText(ownOrPublicScope(null));

    expect(text).toContain(`"comments"."moderation_state" = 'published'`);
    expect(text).toContain(`"public_scope_restriction"."kind" = 'shadow'`);
    expect(text).not.toContain('"author_id" = $');
  });

  it('adds the viewer own comments, whatever their state, by author id', () => {
    const scope = ownOrPublicScope({ id: 'viewer-1' });

    expect(sqlText(scope)).toContain(' or "comments"."author_id" = $1');
    expect(sqlParams(scope)).toEqual(['viewer-1']);
  });

  it('reads a ban of the channel the comment is filed under, never one of another channel', () => {
    expect(sqlText(ownOrPublicScope(null))).toContain(
      '"public_scope_restriction"."channel_id" = "comments"."channel_id"'
    );
  });

  it('asks the same of the root a reply sits under', () => {
    const text = sqlText(publicCommentScope(null));

    expect(text).toContain('"comments"."parent_id" is null or exists');
    expect(text).toContain('"public_scope_parent"."id" = "comments"."parent_id"');
    expect(text).toContain(`"public_scope_parent"."moderation_state" = 'published'`);
  });
});
