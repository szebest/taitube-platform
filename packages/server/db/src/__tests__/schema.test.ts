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
import { referenceFrom } from './foreign-key';

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
  ])('$scenario', ({ table, column, expected }) => {
    expect(referenceFrom(table, column)).toEqual(expected);
  });

  it('counts views in a bigint that starts at zero', () => {
    expect(videos.viewsCount.getSQLType()).toBe('bigint');
    expect(videos.viewsCount.default).toBe(0);
  });

  it('starts a video with no tags, indexed for containment queries', () => {
    const tagsIndex = getTableConfig(videos).indexes.find(
      (index) => index.config.name === 'videos_tags_idx'
    );

    expect(videos.tags.getSQLType()).toBe('text[]');
    expect(videos.tags.notNull).toBe(true);
    expect(videos.tags.default).toEqual([]);
    expect(tagsIndex?.config.method).toBe('gin');
  });

  it('leaves the custom thumbnail empty until a creator picks one', () => {
    expect(videos.customThumbnailKey.notNull).toBe(false);
    expect(videos.customThumbnailKey.default).toBeUndefined();
  });
});
