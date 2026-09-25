import { ErrorCodes } from '@vp/errors';
import { getVideoAsAdmin, takeDownVideo } from '../admin-videos';
import { getVideo } from '../videos';

describe('packages/api-contracts: admin videos', () => {
  it('declares GET /v1/admin/videos/:id', () => {
    expect(getVideoAsAdmin.method).toBe('GET');
    expect(getVideoAsAdmin.path).toBe('/v1/admin/videos/:id');
    expect(getVideoAsAdmin.status).toBe(200);
  });

  it('answers with the same resource the public route does, so an operator sees no other shape', () => {
    expect(getVideoAsAdmin.result).toBe(getVideo.result);
    expect(getVideoAsAdmin.params).toBe(getVideo.params);
  });

  it('declares the 403 the public route does not, which is the whole reason it exists', () => {
    expect(getVideoAsAdmin.errors?.[403]).toContain(ErrorCodes.FORBIDDEN);
    expect(Object.keys(getVideo.errors ?? {})).not.toContain('403');
  });

  it('still declares 404, because an operator can ask for a video that is genuinely gone', () => {
    expect(getVideoAsAdmin.errors?.[404]).toContain(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('takes a video down with a POST that answers with the video as it now stands', () => {
    expect(takeDownVideo).toMatchObject({ method: 'POST', path: '/v1/admin/videos/:id/takedown' });
    expect(takeDownVideo.result).toBe(getVideo.result);
  });

  it('keeps the takedown reason short enough to live in an event', () => {
    expect(takeDownVideo.body.safeParse({ reason: 'a'.repeat(501) }).success).toBe(false);
    expect(takeDownVideo.body.safeParse({}).success).toBe(true);
  });
});
