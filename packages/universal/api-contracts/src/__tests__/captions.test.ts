import { MAX_CAPTION_FILE_BYTES } from '@vp/domain';
import {
  deleteCaptionTrack,
  editCaptionCues,
  generateCaptions,
  getTranscript,
  listCaptions,
  setChannelAutoCaptions,
  updateCaptionSettings,
  uploadCaptionTrack,
} from '../captions';

describe('packages/api-contracts: captions', () => {
  it.each([
    { endpoint: listCaptions, method: 'GET', path: '/v1/videos/:id/captions' },
    { endpoint: getTranscript, method: 'GET', path: '/v1/videos/:id/transcript' },
    { endpoint: updateCaptionSettings, method: 'PATCH', path: '/v1/videos/:id/captions' },
    { endpoint: uploadCaptionTrack, method: 'PUT', path: '/v1/videos/:id/captions/:lang' },
    { endpoint: editCaptionCues, method: 'PATCH', path: '/v1/videos/:id/captions/:lang' },
    { endpoint: deleteCaptionTrack, method: 'DELETE', path: '/v1/videos/:id/captions/:lang' },
    { endpoint: generateCaptions, method: 'POST', path: '/v1/videos/:id/captions/generate' },
    { endpoint: setChannelAutoCaptions, method: 'PUT', path: '/v1/me/channel/auto-captions' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it('opens only the two reads to anonymous viewers', () => {
    expect([listCaptions.anonymous, getTranscript.anonymous]).toEqual([true, true]);
    expect(uploadCaptionTrack).not.toHaveProperty('anonymous');
  });

  it('takes the WebVTT file as the body and names its size limit', () => {
    expect(uploadCaptionTrack.body.parse('WEBVTT\n')).toBe('WEBVTT\n');
    expect(uploadCaptionTrack.description).toContain(String(MAX_CAPTION_FILE_BYTES));
  });

  it.each([
    { name: 'null to follow the channel', body: { autoCaptions: null }, success: true },
    { name: 'a missing switch', body: {}, success: false },
  ])('reads $name on the switch', ({ body, success }) => {
    expect(updateCaptionSettings.body.safeParse(body).success).toBe(success);
  });

  it('refuses a cue edit that names no cue', () => {
    expect(editCaptionCues.body.safeParse({ version: 1, cues: [] }).success).toBe(false);
  });

  it.each([
    { endpoint: generateCaptions, code: 'CAPTION_OVERWRITE_UNCONFIRMED' },
    { endpoint: uploadCaptionTrack, code: 'CAPTION_TRACK_LIMIT' },
  ])('promises $code as a 409', ({ endpoint, code }) => {
    expect(endpoint.errors[409]).toContain(code);
  });
});
