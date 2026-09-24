import {
  RENDITION_STATUSES,
  STEP_STATUSES,
  UPLOAD_STATUSES,
  USER_ROLES,
  VIDEO_STATUSES,
} from '@vp/domain';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  categories,
  renditionStatusEnum,
  stepStatusEnum,
  uploadStatusEnum,
  userRoleEnum,
  users,
  videoStatusEnum,
  videos,
} from '../schema';

function referenceFrom(column: string) {
  const foreignKey = getTableConfig(videos).foreignKeys.find((key) =>
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

  it('keeps a video when its category is deleted', () => {
    expect(referenceFrom('category_id')).toEqual({
      table: getTableConfig(categories).name,
      onDelete: 'set null',
    });
  });

  it('refuses to delete a user who still owns a video', () => {
    expect(referenceFrom('owner_id')).toEqual({ table: 'users', onDelete: 'no action' });
  });
});
