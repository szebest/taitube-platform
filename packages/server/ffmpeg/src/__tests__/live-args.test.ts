import { CANONICAL_LADDER } from '@vp/job-contracts';
import { buildLiveArgs } from '../live-args';

const [, RUNG_720P] = CANONICAL_LADDER;

const args = buildLiveArgs({
  inputUrl: 'rtsp://ingest:8554/live/key',
  rendition: RUNG_720P,
  fps: 30,
  segmentMs: 2000,
  partMs: 500,
  readTimeoutMs: 10_000,
  preset: 'veryfast',
  threads: 2,
});

function argAfter(flag: string): string | undefined {
  return args[args.indexOf(flag) + 1];
}

describe('@vp/ffmpeg: buildLiveArgs', () => {
  it.each([
    { flag: '-i', value: 'rtsp://ingest:8554/live/key' },
    { flag: '-rtsp_transport', value: 'tcp' },
    { flag: '-timeout', value: '10000000' },
    { flag: '-r', value: '30' },
    { flag: '-g', value: '60' },
    { flag: '-keyint_min', value: '60' },
    { flag: '-force_key_frames', value: 'expr:gte(t,n_forced*2)' },
    { flag: '-tune', value: 'zerolatency' },
    { flag: '-f', value: 'mp4' },
    { flag: '-frag_duration', value: '500000' },
    { flag: '-movflags', value: '+frag_keyframe+empty_moov+default_base_moof' },
  ])('sets $flag to $value', ({ flag, value }) => {
    expect(argAfter(flag)).toBe(value);
  });

  it('writes the fragmented stream to stdout', () => {
    expect(args.at(-1)).toBe('pipe:1');
  });
});
