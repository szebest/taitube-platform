import { getTableConfig } from 'drizzle-orm/pg-core';
import { recommendationFeedback } from '../recommendation-feedback-schema';
import { referenceFrom } from './foreign-key';

describe('db: recommendation feedback schema', () => {
  it.each([
    { scenario: 'a deleted user takes their feedback', column: 'user_id', target: 'users' },
    { scenario: 'a purged video takes its feedback', column: 'video_id', target: 'videos' },
    { scenario: 'a deleted channel takes its feedback', column: 'channel_id', target: 'channels' },
  ])('$scenario', ({ column, target }) => {
    expect(referenceFrom(recommendationFeedback, column)).toEqual({
      table: target,
      onDelete: 'cascade',
    });
  });

  it('guards the kind and the column of its kind in the database', () => {
    expect(getTableConfig(recommendationFeedback).checks.map(({ name }) => name)).toEqual([
      'recommendation_feedback_target_check',
    ]);
  });

  it.each([
    'recommendation_feedback_user_video_idx',
    'recommendation_feedback_user_channel_idx',
    'recommendation_feedback_user_created_idx',
  ])('indexes %s', (name) => {
    expect(
      getTableConfig(recommendationFeedback).indexes.map((index) => index.config.name)
    ).toContain(name);
  });
});
