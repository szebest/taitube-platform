import {
  RENDITION_STATUSES,
  STEP_STATUSES,
  UPLOAD_STATUSES,
  USER_ROLES,
  VIDEO_STATUSES,
} from '@vp/domain';
import { type PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import {
  categories,
  renditionStatusEnum,
  stepStatusEnum,
  uploadStatusEnum,
  userRoleEnum,
  users,
  videoComments,
  videoStatusEnum,
  videos,
} from '../schema';

function referenceFrom(table: PgTable, column: string) {
  const foreignKey = getTableConfig(table).foreignKeys.find((key) =>
    key.reference().columns.some((local) => local.name === column)
  );
  const reference = foreignKey?.reference();
  return {
    table: reference === undefined ? undefined : getTableConfig(reference.foreignTable).name,
    onDelete: foreignKey?.onDelete,
  };
}

describe('db: schema', () => {
  it.each([
    { name: 'video_status', values: videoStatusEnum.enumValues, vocabulary: VIDEO_STATUSES },
    { name: 'upload_status', values: uploadStatusEnum.enumValues, vocabulary: UPLOAD_STATUSES },
    {
      name: 'rendition_status',
      values: renditionStatusEnum.enumValues,
      vocabulary: RENDITION_STATUSES,
    },
    { name: 'step_status', values: stepStatusEnum.enumValues, vocabulary: STEP_STATUSES },
    { name: 'user_role', values: userRoleEnum.enumValues, vocabulary: USER_ROLES },
  ])('builds the $name enum from the domain vocabulary', ({ values, vocabulary }) => {
    expect(values).toEqual([...vocabulary]);
  });

  it('gives a new user the USER role', () => {
    expect(users.role.default).toBe('USER');
    expect(users.role.notNull).toBe(true);
  });

  it.each([
    {
      scenario: 'keeps a video when its category is deleted',
      table: videos,
      column: 'category_id',
      expected: { table: getTableConfig(categories).name, onDelete: 'set null' },
    },
    {
      scenario: 'refuses to delete a user who still owns a video',
      table: videos,
      column: 'owner_id',
      expected: { table: 'users', onDelete: 'no action' },
    },
    {
      scenario: 'drops the comments of a deleted video',
      table: videoComments,
      column: 'video_id',
      expected: { table: 'videos', onDelete: 'cascade' },
    },
    {
      scenario: 'drops the replies of a deleted comment',
      table: videoComments,
      column: 'parent_id',
      expected: { table: 'video_comments', onDelete: 'cascade' },
    },
    {
      scenario: 'refuses to delete a user who still authors a comment',
      table: videoComments,
      column: 'author_id',
      expected: { table: 'users', onDelete: 'no action' },
    },
  ])('$scenario', ({ table, column, expected }) => {
    expect(referenceFrom(table, column)).toEqual(expected);
  });
});
