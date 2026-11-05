import { type LlHlsSegment, renderArchivePlaylist, renderLivePlaylist } from '../ll-hls-playlist';

const PARTS_PER_SEGMENT = 4;

function segment(sequence: number, discontinuity = 0): LlHlsSegment {
  return {
    sequence,
    discontinuity,
    mapUri: `${discontinuity}/init.mp4`,
    uri: `${discontinuity}/${sequence}.m4s`,
    durationMs: 2000,
    parts: Array.from({ length: PARTS_PER_SEGMENT }, (_, part) => ({
      uri: `${discontinuity}/${sequence}.${part}.m4s`,
      durationMs: 500,
      independent: part === 0,
    })),
  };
}

const TIMING = { segmentMs: 2000, partMs: 500, partSegments: 1 };

describe('@vp/ffmpeg: renderLivePlaylist', () => {
  it('lists the window, the parts of the newest segment and of the one being written', () => {
    const playlist = renderLivePlaylist({
      ...TIMING,
      segments: [segment(7), segment(8)],
      open: { ...segment(9), parts: segment(9).parts.slice(0, 2) },
    });

    expect(playlist).toBe(
      [
        '#EXTM3U',
        '#EXT-X-VERSION:9',
        '#EXT-X-TARGETDURATION:2',
        '#EXT-X-SERVER-CONTROL:PART-HOLD-BACK=1.500',
        '#EXT-X-PART-INF:PART-TARGET=0.500',
        '#EXT-X-MEDIA-SEQUENCE:7',
        '#EXT-X-DISCONTINUITY-SEQUENCE:0',
        '#EXT-X-MAP:URI="0/init.mp4"',
        '#EXTINF:2.000,',
        '0/7.m4s',
        '#EXT-X-PART:DURATION=0.500,URI="0/8.0.m4s",INDEPENDENT=YES',
        '#EXT-X-PART:DURATION=0.500,URI="0/8.1.m4s"',
        '#EXT-X-PART:DURATION=0.500,URI="0/8.2.m4s"',
        '#EXT-X-PART:DURATION=0.500,URI="0/8.3.m4s"',
        '#EXTINF:2.000,',
        '0/8.m4s',
        '#EXT-X-PART:DURATION=0.500,URI="0/9.0.m4s",INDEPENDENT=YES',
        '#EXT-X-PART:DURATION=0.500,URI="0/9.1.m4s"',
        '',
      ].join('\n')
    );
  });

  it('marks a restarted packager with a discontinuity and its own init segment', () => {
    const playlist = renderLivePlaylist({
      ...TIMING,
      partSegments: 0,
      segments: [segment(3, 1), segment(4, 2)],
      open: null,
    });

    expect(playlist).toContain('#EXT-X-DISCONTINUITY-SEQUENCE:1');
    expect(playlist).toContain(
      ['1/3.m4s', '#EXT-X-DISCONTINUITY', '#EXT-X-MAP:URI="2/init.mp4"', '#EXTINF:2.000,'].join(
        '\n'
      )
    );
  });

  it('starts the sequence at the first part when no segment is whole yet', () => {
    const playlist = renderLivePlaylist({ ...TIMING, segments: [], open: segment(0) });

    expect(playlist).toContain('#EXT-X-MEDIA-SEQUENCE:0');
    expect(playlist).toContain('#EXT-X-PART:DURATION=0.500,URI="0/0.0.m4s",INDEPENDENT=YES');
  });

  it('raises the target duration to cover a segment longer than the target', () => {
    const long = { ...segment(1), durationMs: 2600 };

    expect(renderLivePlaylist({ ...TIMING, segments: [long], open: null })).toContain(
      '#EXT-X-TARGETDURATION:3'
    );
  });
});

describe('@vp/ffmpeg: renderArchivePlaylist', () => {
  it.each([
    { ended: false, last: '1/1.m4s' },
    { ended: true, last: '#EXT-X-ENDLIST' },
  ])('lists every segment without parts, ended=$ended', ({ ended, last }) => {
    const playlist = renderArchivePlaylist({
      segments: [segment(0), segment(1, 1)],
      segmentMs: 2000,
      ended,
    });
    const lines = playlist.trimEnd().split('\n');

    expect(lines.slice(0, 5)).toEqual([
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-TARGETDURATION:2',
      '#EXT-X-PLAYLIST-TYPE:EVENT',
      '#EXT-X-MEDIA-SEQUENCE:0',
    ]);
    expect(lines.at(-1)).toBe(last);
    expect(playlist).not.toContain('#EXT-X-PART:');
    expect(playlist).toContain('#EXT-X-DISCONTINUITY\n#EXT-X-MAP:URI="1/init.mp4"');
  });
});
