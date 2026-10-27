import type { CaptionTrack } from '@vp/domain';
import { toCaptionTrackView, toTranscriptView } from '../caption-views';
import { TEST_CDN } from './service-deps';

const AT = new Date('2026-03-01T12:00:00.000Z');

function track(overrides: Partial<CaptionTrack> = {}): CaptionTrack {
  return {
    id: 'c1',
    videoId: 'v1',
    language: 'en',
    detectedLanguage: 'en',
    kind: 'auto',
    status: 'ready',
    modelVersion: 'small-q5_1',
    reason: null,
    version: 3,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

describe('caption views', () => {
  it('points a ready track at its WebVTT file on the CDN', () => {
    expect(toCaptionTrackView(track(), TEST_CDN, false)).toEqual({
      id: 'c1',
      language: 'en',
      kind: 'auto',
      status: 'ready',
      url: `${TEST_CDN}/videos/v1/captions/en/captions.vtt`,
    });
  });

  it.each([
    { name: 'a pending track', overrides: { status: 'pending' as const } },
    { name: 'a track with no language yet', overrides: { language: null } },
  ])('gives $name no url', ({ overrides }) => {
    expect(toCaptionTrackView(track(overrides), TEST_CDN, false).url).toBeNull();
  });

  it('shows a manager why a track failed and the version an edit is checked against', () => {
    const failed = track({ status: 'failed', reason: 'WHISPER_TIMEOUT' });

    expect(toCaptionTrackView(failed, TEST_CDN, true)).toMatchObject({
      reason: 'WHISPER_TIMEOUT',
      version: 3,
    });
  });

  it('names the track a transcript was read from', () => {
    const cues = [{ index: 0, startMs: 0, endMs: 900, text: 'Hello' }];

    expect(toTranscriptView(track({ kind: 'edited' }), cues)).toEqual({
      captionId: 'c1',
      language: 'en',
      kind: 'edited',
      cues,
    });
  });
});
