import {
  completeChannelImage,
  getChannelSpotlight,
  getMySpotlight,
  prepareChannelImage,
  revealChannelContact,
  setMySpotlight,
} from '../channel-identity';

const ID = '00000000-0000-7000-8000-0000000000a1';
const CROP = { x: 0, y: 0, width: 400, height: 400 };

describe('packages/api-contracts: channel identity', () => {
  it.each([
    {
      endpoint: prepareChannelImage,
      method: 'POST',
      path: '/v1/me/channel/images/:kind/upload',
      status: 201,
    },
    {
      endpoint: completeChannelImage,
      method: 'POST',
      path: '/v1/me/channel/images/:kind/complete',
      status: 202,
    },
    {
      endpoint: getChannelSpotlight,
      method: 'GET',
      path: '/v1/channels/:idOrHandle/spotlight',
      status: 200,
    },
    { endpoint: getMySpotlight, method: 'GET', path: '/v1/me/channel/spotlight', status: 200 },
    { endpoint: setMySpotlight, method: 'PUT', path: '/v1/me/channel/spotlight', status: 200 },
    {
      endpoint: revealChannelContact,
      method: 'POST',
      path: '/v1/channels/:id/contact-reveal',
      status: 200,
    },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it('reads the spotlight without a sign-in', () => {
    expect(getChannelSpotlight.anonymous).toBe(true);
  });

  it.each([
    { kind: 'avatar', ok: true },
    { kind: 'banner', ok: true },
    { kind: 'cover', ok: false },
  ])('takes the image kind $kind: $ok', ({ kind, ok }) => {
    expect(prepareChannelImage.params.safeParse({ kind }).success).toBe(ok);
  });

  it.each([
    { scenario: 'a file', body: { contentType: 'image/png', sizeBytes: 1000 }, ok: true },
    { scenario: 'no size', body: { contentType: 'image/png' }, ok: false },
    { scenario: 'a zero size', body: { contentType: 'image/png', sizeBytes: 0 }, ok: false },
  ])('checks the presign body of $scenario', ({ body, ok }) => {
    expect(prepareChannelImage.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    {
      scenario: 'an avatar crop',
      body: { uploadId: ID, width: 800, height: 800, crop: CROP },
      ok: true,
    },
    { scenario: 'a text upload id', body: { uploadId: 'x', width: 800, height: 800 }, ok: false },
    { scenario: 'no dimensions', body: { uploadId: ID }, ok: false },
  ])('checks the complete body of $scenario', ({ body, ok }) => {
    expect(completeChannelImage.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    {
      scenario: 'nothing set',
      body: { trailerVideoId: null, returningVideoId: null, localizations: [] },
      ok: true,
    },
    {
      scenario: 'a localization',
      body: {
        trailerVideoId: ID,
        returningVideoId: null,
        localizations: [{ locale: 'pl', description: 'Opis', trailerVideoId: null }],
      },
      ok: true,
    },
    {
      scenario: 'a text video id',
      body: { trailerVideoId: 'x', returningVideoId: null, localizations: [] },
      ok: false,
    },
    {
      scenario: 'a missing list',
      body: { trailerVideoId: null, returningVideoId: null },
      ok: false,
    },
  ])('checks the spotlight body of $scenario', ({ body, ok }) => {
    expect(setMySpotlight.body.safeParse(body).success).toBe(ok);
  });

  it('hands the address back as an email', () => {
    expect(revealChannelContact.result.safeParse({ email: 'hi@example.com' }).success).toBe(true);
    expect(revealChannelContact.result.safeParse({ email: 'nope' }).success).toBe(false);
  });
});
