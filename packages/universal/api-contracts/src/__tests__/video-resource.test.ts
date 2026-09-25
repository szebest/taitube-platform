import { VideoIdParamSchema, VideoListResponseSchema, VideoSummarySchema } from '../video-resource';

const summary = {
  id: '00000000-0000-7000-8000-0000000000f1',
  ownerId: '00000000-0000-7000-8000-000000000002',
  title: 'A video',
  description: null,
  visibility: 'public',
  status: 'READY',
  version: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('packages/api-contracts: video resource', () => {
  it('accepts a minimal summary and rejects an unknown status', () => {
    expect(VideoSummarySchema.parse(summary).id).toBe(summary.id);
    expect(VideoSummarySchema.safeParse({ ...summary, status: 'TRANSCODING' }).success).toBe(false);
  });

  it('carries a nullable cursor on a page of summaries', () => {
    expect(VideoListResponseSchema.parse({ items: [summary], nextCursor: null })).toMatchObject({
      nextCursor: null,
    });
  });

  it('rejects a non-uuid video id', () => {
    expect(VideoIdParamSchema.safeParse({ id: '42' }).success).toBe(false);
  });
});
