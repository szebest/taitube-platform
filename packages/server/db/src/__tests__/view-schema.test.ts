import { getTableConfig } from 'drizzle-orm/pg-core';
import { videoViewBatches, videoViewsDaily } from '../view-schema';

describe('db: view schema', () => {
  it("drops a video's daily views with the video", () => {
    const [foreignKey] = getTableConfig(videoViewsDaily).foreignKeys;
    const reference = foreignKey?.reference();

    expect(reference && getTableConfig(reference.foreignTable).name).toBe('videos');
    expect(foreignKey?.onDelete).toBe('cascade');
  });

  it('keys daily views by video and day, and indexes them newest day first', () => {
    const config = getTableConfig(videoViewsDaily);

    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      'video_id',
      'view_date',
    ]);
    expect(config.indexes.map((index) => index.config.name)).toEqual([
      'video_views_daily_date_video_idx',
    ]);
  });

  it('keys the flush ledger by batch id, indexed by when it was applied', () => {
    const config = getTableConfig(videoViewBatches);

    expect(videoViewBatches.batchId.primary).toBe(true);
    expect(config.indexes.map((index) => index.config.name)).toEqual([
      'video_view_batches_applied_at_idx',
    ]);
  });
});
