import { getTableConfig } from 'drizzle-orm/pg-core';
import { videoEdits, videoGenerations } from '../video-pipeline-schema';
import { referenceFrom } from './foreign-key';

describe('db: video pipeline schema', () => {
  it.each([
    { scenario: 'a purged video takes its generations', table: videoGenerations },
    { scenario: 'a purged video takes its edit list', table: videoEdits },
  ])('$scenario', ({ table }) => {
    expect(referenceFrom(table, 'video_id')).toEqual({ table: 'videos', onDelete: 'cascade' });
  });

  it.each([
    {
      table: videoGenerations,
      checks: [
        'video_generations_kind_check',
        'video_generations_status_check',
        'video_generations_generation_check',
      ],
    },
    { table: videoEdits, checks: ['video_edits_status_check', 'video_edits_blurs_check'] },
  ])('guards the limits of $table in the database', ({ table, checks }) => {
    expect(getTableConfig(table).checks.map((constraint) => constraint.name)).toEqual(checks);
  });

  it('holds at most one replacement or edit in flight per video', () => {
    const inFlight = getTableConfig(videoGenerations).indexes.find(
      (index) => index.config.name === 'video_generations_in_flight_idx'
    );

    expect(inFlight?.config).toMatchObject({ unique: true });
    expect(inFlight?.config.where).toBeDefined();
  });
});
