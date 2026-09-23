import { ErrorCodes } from '@vp/errors';
import { getVideoAsAdmin } from '../admin-videos';
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
});
