import type { CommentViewer } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type SQL, eq, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { aliasedTable } from './aliased-table';

const { videoComments, videos, channels, channelUserRestrictions } = schema;

interface CommentTable {
  videoId: AnyPgColumn;
  authorId: AnyPgColumn;
  parentId: AnyPgColumn;
  moderationState: AnyPgColumn;
}

const restriction = aliasedTable(channelUserRestrictions, 'public_scope_restriction');
const channel = aliasedTable(channels, 'public_scope_channel');
const video = aliasedTable(videos, 'public_scope_video');
const parent = aliasedTable(videoComments, 'public_scope_parent');

/** A shadow ban is read here, on every read, so lifting it rewrites nothing. */
function publicOf(table: CommentTable): SQL {
  return sql`(${table.moderationState} = 'published' and not exists (
    select 1 from ${restriction.from}
    inner join ${channel.from} on ${channel.table.id} = ${restriction.table.channelId}
    inner join ${video.from} on ${video.table.ownerId} = ${channel.table.userId}
    where ${video.table.id} = ${table.videoId}
      and ${restriction.table.userId} = ${table.authorId}
      and ${restriction.table.kind} = 'shadow'
  ))`;
}

/** What the viewer sees of one comment: the public ones and their own, whatever their state. */
export function ownOrPublicScope(viewer: CommentViewer, table: CommentTable = videoComments): SQL {
  const published = publicOf(table);
  return viewer ? (or(published, eq(table.authorId, viewer.id)) ?? published) : published;
}

/**
 * The only way comments are read. A reply is visible only under a root the viewer may see, so a
 * hidden or held root takes its replies out of the thread with it.
 */
export function publicCommentScope(
  viewer: CommentViewer,
  table: CommentTable = videoComments
): SQL {
  return sql`(${ownOrPublicScope(viewer, table)} and (${table.parentId} is null or exists (
    select 1 from ${parent.from}
    where ${parent.table.id} = ${table.parentId} and ${ownOrPublicScope(viewer, parent.table)}
  )))`;
}
