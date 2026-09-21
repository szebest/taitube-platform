import type { RenditionRecord } from '@vp/core/ports';
import { toRenditionInsert, toRenditionUpdate } from '../rendition.mapper';

describe('adapters/postgres/mappers: rendition', () => {
  const required = {
    videoId: 'vid-1',
    name: '720p',
    width: 1280,
    height: 720,
    videoBitrateKbps: 2800,
    audioBitrateKbps: 128,
  };

  it('fills the columns the domain input leaves out', () => {
    const row = toRenditionInsert(required);
    expect(row).toMatchObject({
      ...required,
      status: 'PENDING',
      playlistKey: null,
      segmentCount: null,
      bytes: null,
    });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps a supplied id and status', () => {
    const row = toRenditionInsert({ ...required, id: 'ren-1', status: 'DONE' });
    expect(row.id).toBe('ren-1');
    expect(row.status).toBe('DONE');
  });

  it('always stamps updatedAt', () => {
    expect(toRenditionUpdate({}).updatedAt).toBeInstanceOf(Date);
  });

  it.each<{ field: keyof RenditionRecord; value: unknown }>([
    { field: 'status', value: 'FAILED' },
    { field: 'playlistKey', value: 'hls/720p/index.m3u8' },
    { field: 'segmentCount', value: 12 },
    { field: 'bytes', value: 2048 },
    { field: 'processingMs', value: 900 },
  ])('carries $field through when present', ({ field, value }) => {
    expect(toRenditionUpdate({ [field]: value })).toMatchObject({ [field]: value });
  });

  it('omits absent fields rather than nulling them', () => {
    expect(Object.keys(toRenditionUpdate({ bytes: 1 })).sort()).toEqual(['bytes', 'updatedAt']);
  });

  it('distinguishes an explicit null from an absent field', () => {
    expect(toRenditionUpdate({ playlistKey: null })).toHaveProperty('playlistKey', null);
  });
});
