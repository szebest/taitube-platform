import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  shareLinkStats,
  shareLinks,
  videoExperimentStats,
  videoExperiments,
} from '../video-access-schema';
import { referenceFrom } from './foreign-key';

describe('db: video access schema', () => {
  it.each([
    {
      scenario: 'a deleted creator keeps the link',
      table: shareLinks,
      column: 'created_by',
      target: 'users',
      onDelete: 'set null',
    },
    {
      scenario: 'a link takes its numbers',
      table: shareLinkStats,
      column: 'link_id',
      target: 'share_links',
      onDelete: 'cascade',
    },
    {
      scenario: 'a purged video takes its tests',
      table: videoExperiments,
      column: 'video_id',
      target: 'videos',
      onDelete: 'cascade',
    },
    {
      scenario: 'a test takes its numbers',
      table: videoExperimentStats,
      column: 'experiment_id',
      target: 'video_experiments',
      onDelete: 'cascade',
    },
  ])('$scenario', ({ table, column, target, onDelete }) => {
    expect(referenceFrom(table, column)).toEqual({ table: target, onDelete });
  });

  it.each([
    {
      table: shareLinks,
      checks: [
        'share_links_target_type_check',
        'share_links_token_check',
        'share_links_label_check',
      ],
    },
    {
      table: videoExperiments,
      checks: [
        'video_experiments_kind_check',
        'video_experiments_status_check',
        'video_experiments_winner_check',
      ],
    },
    { table: videoExperimentStats, checks: ['video_experiment_stats_variant_check'] },
  ])('guards the limits of $table in the database', ({ table, checks }) => {
    expect(getTableConfig(table).checks.map((constraint) => constraint.name)).toEqual(checks);
  });

  it('finds a link by its token, once', () => {
    const token = getTableConfig(shareLinks).indexes.find(
      (index) => index.config.name === 'share_links_token_idx'
    );

    expect(token?.config.unique).toBe(true);
  });

  it('runs one test per video at a time', () => {
    const running = getTableConfig(videoExperiments).indexes.find(
      (index) => index.config.name === 'video_experiments_running_idx'
    );

    expect(running?.config).toMatchObject({ unique: true });
    expect(running?.config.where).toBeDefined();
  });
});
