import { describe, expect, it } from 'vitest';
import { ProbeJob, QUEUES, ids } from '../src/index.js';

describe('@vp/job-contracts smoke test', () => {
  it('builds deterministic job IDs with -- separator', () => {
    const videoId = '11111111-1111-7111-8111-111111111111';
    expect(ids.probe(videoId, 1)).toBe(`${videoId}--probe--g1`);
    expect(ids.transcode(videoId, '720p', 1)).toBe(`${videoId}--transcode--720p--g1`);
    expect(ids.thumbnail(videoId, 1)).toBe(`${videoId}--thumbnail--g1`);
    expect(ids.package(videoId, 1)).toBe(`${videoId}--package--g1`);
  });

  it('validates probe job payload', () => {
    const parsed = ProbeJob.parse({
      videoId: '11111111-1111-7111-8111-111111111111',
      generation: 1,
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      sourceKey: 'raw/11111111-1111-7111-8111-111111111111/source.mp4',
    });
    expect(parsed.generation).toBe(1);
  });

  it('includes all required queues', () => {
    expect(QUEUES).toContain('probe');
    expect(QUEUES).toContain('transcode-1080p');
    expect(QUEUES).toContain('transcode-720p');
    expect(QUEUES).toContain('transcode-480p');
    expect(QUEUES).toContain('thumbnail');
    expect(QUEUES).toContain('package');
    expect(QUEUES).toContain('notify');
    expect(QUEUES).toContain('housekeeping');
    expect(QUEUES).toContain('dlq');
  });
});
