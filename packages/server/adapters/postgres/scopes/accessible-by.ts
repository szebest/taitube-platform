import { videos } from '@vp/db';
import { PUBLIC_FEED_VISIBILITY } from '@vp/domain';
import type { AppAction, AppSubjects, UserContext } from '@vp/permissions';
import { type SQL, eq } from 'drizzle-orm';
import type { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import { type Viewer, rulesToSql } from './rules-to-sql';
import type { WithOwner, WithVisibility } from './traits';

/**
 * Row-level scope for any subject backed by a Drizzle table, compiled from the viewer's CASL rules.
 * Returns undefined when the rules impose no restriction.
 */
export function accessibleBy<T extends TableConfig>(
  viewer: Viewer,
  subject: AppSubjects,
  table: PgTableWithColumns<T>,
  action: AppAction = 'read'
): SQL | undefined {
  return rulesToSql(action, subject, viewer, table);
}

export function videoReadScope(viewer: Viewer): SQL | undefined {
  return accessibleBy(viewer, 'Video', videos, 'read');
}

export function ownerScope<T extends WithOwner>(table: T, owner: UserContext | string): SQL {
  return eq(table.ownerId, typeof owner === 'string' ? owner : owner.id);
}

/**
 * Feed policy rather than authorization: unlisted videos stay readable by link but must
 * never surface in a listing.
 */
export function publicVisibilityScope<T extends WithVisibility>(table: T): SQL {
  return eq(table.visibility, PUBLIC_FEED_VISIBILITY);
}
