import { autoCaptionsEnabled, isGeneratedTrack } from '../captions';

describe('domain: captions', () => {
  it.each([
    { video: true, channel: true, enabled: true },
    { video: true, channel: false, enabled: true },
    { video: false, channel: true, enabled: false },
    { video: false, channel: false, enabled: false },
    { video: null, channel: true, enabled: true },
    { video: null, channel: false, enabled: false },
  ])(
    'captions a video set to $video on a channel defaulting to $channel: $enabled',
    ({ video, channel, enabled }) => {
      expect(autoCaptionsEnabled(video, channel)).toBe(enabled);
    }
  );

  it.each([
    { kind: 'auto', generated: true },
    { kind: 'edited', generated: true },
    { kind: 'uploaded', generated: false },
  ] as const)('treats an $kind track as generated: $generated', ({ kind, generated }) => {
    expect(isGeneratedTrack({ kind })).toBe(generated);
  });
});
