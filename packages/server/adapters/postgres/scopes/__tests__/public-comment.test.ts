import { ownOrPublicScope, publicCommentScope } from '../public-comment';
import { sqlParams, sqlText } from './sql-text';

describe('adapters/postgres: public comment scope', () => {
  it('admits published comments of authors no shadow ban hides, and nothing else, to a stranger', () => {
    const text = sqlText(ownOrPublicScope(null));

    expect(text).toContain(`"video_comments"."moderation_state" = 'published'`);
    expect(text).toContain(`"public_scope_restriction"."kind" = 'shadow'`);
    expect(text).not.toContain('"author_id" = $');
  });

  it('adds the viewer own comments, whatever their state, by author id', () => {
    const scope = ownOrPublicScope({ id: 'viewer-1' });

    expect(sqlText(scope)).toContain(' or "video_comments"."author_id" = $1');
    expect(sqlParams(scope)).toEqual(['viewer-1']);
  });

  it('reads a ban of the video owner channel, never one of another channel', () => {
    const text = sqlText(ownOrPublicScope(null));

    expect(text).toContain('"public_scope_video"."owner_id" = "public_scope_channel"."user_id"');
    expect(text).toContain('"public_scope_video"."id" = "video_comments"."video_id"');
  });

  it('asks the same of the root a reply sits under', () => {
    const text = sqlText(publicCommentScope(null));

    expect(text).toContain('"video_comments"."parent_id" is null or exists');
    expect(text).toContain('"public_scope_parent"."id" = "video_comments"."parent_id"');
    expect(text).toContain(`"public_scope_parent"."moderation_state" = 'published'`);
  });
});
