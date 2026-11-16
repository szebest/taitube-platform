import { videos } from '@vp/db';
import { msTimestamp } from '../ms-timestamp';
import { sqlText } from './sql-text';

describe('adapters/postgres/scoping: millisecond timestamp', () => {
  it('cuts the column to the milliseconds a cursor carries', () => {
    expect(sqlText(msTimestamp(videos.createdAt))).toBe(
      `date_trunc('milliseconds', "videos"."created_at")`
    );
  });
});
