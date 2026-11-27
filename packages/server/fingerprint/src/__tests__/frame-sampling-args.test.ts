import { FRAME_BYTES, buildFrameSamplingArgs } from '../frame-sampling-args';

describe('@vp/fingerprint: buildFrameSamplingArgs', () => {
  it('asks for a 9x8 greyscale frame every interval as raw bytes on stdout', () => {
    const args = buildFrameSamplingArgs({
      sourcePath: 'https://s3/source.mp4',
      intervalSeconds: 2,
    });

    expect(args).toEqual([
      '-hide_banner',
      '-nostdin',
      '-loglevel',
      'error',
      '-i',
      'https://s3/source.mp4',
      '-an',
      '-sn',
      '-vf',
      'fps=1/2,scale=9:8:flags=area,format=gray',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      'pipe:1',
    ]);
  });

  it('follows the interval it is given', () => {
    const filter = buildFrameSamplingArgs({ sourcePath: 'a.mp4', intervalSeconds: 5 }).at(9);

    expect(filter).toContain('fps=1/5');
  });

  it('holds nine columns by eight rows', () => {
    expect(FRAME_BYTES).toBe(72);
  });
});
