import { sqlParams, sqlText } from '../../scopes/__tests__/sql-text';
import { videoScanScope } from '../video-scan-query';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('adapters/postgres: video scan SQL query', () => {
  it('scans one status when nothing else is asked', () => {
    const scope = videoScanScope({ status: 'UPLOADING' }, NOW);

    expect(sqlText(scope)).toBe('"videos"."status" = $1');
    expect(sqlParams(scope)).toEqual(['UPLOADING']);
  });

  it('reads idleness from the named clock, falling back to the last update', () => {
    const scope = videoScanScope(
      { status: 'DELETED', idleFor: { since: 'deletedAt', ms: 60_000 } },
      NOW
    );

    expect(sqlText(scope)).toContain('COALESCE("videos"."deleted_at", "videos"."updated_at") < $2');
    expect(sqlParams(scope)).toContainEqual(new Date(NOW.getTime() - 60_000));
  });

  it('keeps videos from a minimum generation up', () => {
    expect(sqlText(videoScanScope({ status: 'READY', minGeneration: 2 }, NOW))).toContain(
      '"videos"."generation" >= $2'
    );
  });

  it.each([
    {
      without: { type: 'step' as const, step: 'probe' },
      table: '"processing_steps"',
      column: '"processing_steps"."step" = $2',
    },
    {
      without: { type: 'event' as const, event: 'video.raw_expired' },
      table: '"video_events"',
      column: '"video_events"."type" = $2',
    },
  ])('excludes videos that already have a $without.type', ({ without, table, column }) => {
    const text = sqlText(videoScanScope({ status: 'READY', without }, NOW));

    expect(text).toContain(`not exists (select 1 from ${table} where`);
    expect(text).toContain(column);
  });

  it('scopes an event to the current generation when asked', () => {
    const text = sqlText(
      videoScanScope(
        {
          status: 'READY',
          without: { type: 'event', event: 'video.generation_purged', forCurrentGeneration: true },
        },
        NOW
      )
    );

    expect(text).toContain(
      `("video_events"."payload"->>'generation')::int >= "videos"."generation"`
    );
  });
});
