import {
  ANALYTICS_EXPORT_KINDS,
  DATA_EXPORT_EDGES,
  DATA_EXPORT_KINDS,
  DATA_EXPORT_LIMITS,
  dataExportExpiry,
} from '../data-export';

describe('@vp/domain: data export', () => {
  it('names the datasets a channel can export', () => {
    expect(DATA_EXPORT_KINDS).toEqual([
      'video_analytics',
      'channel_analytics',
      'comments',
      'videos',
      'posts',
    ]);
  });

  it('lets the analytics kinds be a subset of the kinds', () => {
    expect(DATA_EXPORT_KINDS).toEqual(expect.arrayContaining([...ANALYTICS_EXPORT_KINDS]));
  });

  it('caps a channel at ten a day, a million rows and 500 MB, kept for seven days', () => {
    expect(DATA_EXPORT_LIMITS).toEqual({
      perDay: 10,
      maxRows: 1_000_000,
      maxBytes: 524_288_000,
      ttlDays: 7,
    });
  });

  it('restarts a running export, so a retried job finds its own row startable', () => {
    expect(DATA_EXPORT_EDGES.start.from).toEqual(['queued', 'running']);
  });

  it('expires a file seven days after it was ready', () => {
    expect(dataExportExpiry(new Date('2026-03-01T12:00:00.000Z'))).toEqual(
      new Date('2026-03-08T12:00:00.000Z')
    );
  });
});
