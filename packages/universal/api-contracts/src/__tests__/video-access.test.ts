import {
  clearVideoPassword,
  createVideoShareLink,
  isVideoAccessCookie,
  listVideoShareLinks,
  revokeVideoShareLink,
  setVideoPassword,
  ShareTokenSchema,
  unlockVideo,
  videoAccessCookieName,
} from '../video-access';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000a1';

describe('packages/api-contracts: video access', () => {
  it.each([
    {
      endpoint: listVideoShareLinks,
      method: 'GET',
      path: '/v1/creator/videos/:id/share-links',
      status: 200,
    },
    {
      endpoint: createVideoShareLink,
      method: 'POST',
      path: '/v1/creator/videos/:id/share-links',
      status: 201,
    },
    {
      endpoint: revokeVideoShareLink,
      method: 'DELETE',
      path: '/v1/creator/videos/:id/share-links/:linkId',
      status: 204,
    },
    {
      endpoint: setVideoPassword,
      method: 'PUT',
      path: '/v1/creator/videos/:id/password',
      status: 200,
    },
    {
      endpoint: clearVideoPassword,
      method: 'DELETE',
      path: '/v1/creator/videos/:id/password',
      status: 204,
    },
    { endpoint: unlockVideo, method: 'POST', path: '/v1/videos/:id/unlock', status: 204 },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it('unlocks without a sign-in and writes nothing else anonymously', () => {
    expect(unlockVideo.anonymous).toBe(true);
    expect('anonymous' in createVideoShareLink).toBe(false);
  });

  it.each([
    { token: 'abcdefghijklmnopqrst_-', ok: true },
    { token: 'abcdefghijklmnopqrstu', ok: false },
    { token: 'abcdefghijklmnopqrstu/', ok: false },
  ])('takes $token as a token: $ok', ({ token, ok }) => {
    expect(ShareTokenSchema.safeParse(token).success).toBe(ok);
  });

  it.each([
    { body: { expiresIn: '7d' }, ok: true },
    { body: { label: 'Press', expiresIn: 'never' }, ok: true },
    { body: { expiresIn: '2d' }, ok: false },
    { body: {}, ok: false },
  ])('takes $body for a new link: $ok', ({ body, ok }) => {
    expect(createVideoShareLink.body.safeParse(body).success).toBe(ok);
  });

  it('names one cookie per video and recognises only those', () => {
    const name = videoAccessCookieName(VIDEO_ID);

    expect(name).toBe(`vp.video-access.${VIDEO_ID}`);
    expect([isVideoAccessCookie(name), isVideoAccessCookie('vp.session')]).toEqual([true, false]);
  });
});
