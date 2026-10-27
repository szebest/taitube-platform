import { CaptionsJob, ids, ProbeJob, QUEUES } from '../index';

describe('@vp/job-contracts smoke test', () => {
  it('builds deterministic job IDs with -- separator', () => {
    const videoId = '11111111-1111-7111-8111-111111111111';
    expect(ids.probe(videoId, 1)).toBe(`${videoId}--probe--g1`);
    expect(ids.transcode(videoId, '720p', 1)).toBe(`${videoId}--transcode--720p--g1`);
    expect(ids.transcodeChunk(videoId, '720p', 3, 1)).toBe(`${videoId}--transcode--720p--c3--g1`);
    expect(ids.thumbnail(videoId, 1)).toBe(`${videoId}--thumbnail--g1`);
    expect(ids.package(videoId, 1)).toBe(`${videoId}--package--g1`);
    expect(ids.captions(videoId, 'small-q5_1', 2)).toBe(`${videoId}--captions--small-q5_1--v2`);
    expect(ids.captionsChunk(videoId, 'small-q5_1', 2, 3)).toBe(
      `${videoId}--captions--small-q5_1--v2--w3`
    );
  });

  it.each([
    { type: 'single' },
    { type: 'merge', windowCount: 4 },
    { type: 'window', index: 0, windowCount: 4 },
  ])('validates a $type captions job', (plan) => {
    const parsed = CaptionsJob.safeParse({
      videoId: '11111111-1111-7111-8111-111111111111',
      captionId: '22222222-2222-7222-8222-222222222222',
      captionVersion: 1,
      sourceKey: 'raw/11111111-1111-7111-8111-111111111111/source.mp4',
      durationMs: 720_000,
      modelVersion: 'small-q5_1',
      language: null,
      plan,
      traceparent: '',
    });
    expect(parsed.success).toBe(true);
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
    expect(QUEUES).toContain('captions');
    expect(QUEUES).toContain('dlq');
  });
});
