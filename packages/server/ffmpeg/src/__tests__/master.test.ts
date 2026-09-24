import type { LadderEntry } from '@vp/job-contracts';
import { generateMasterPlaylist } from '../master';

const LADDER_720P: LadderEntry = {
  name: '720p',
  width: 1280,
  height: 720,
  videoKbps: 2800,
  maxrateKbps: 2996,
  bufsizeKbps: 4200,
  audioKbps: 128,
  profile: 'high',
  level: '3.1',
};

describe('packages/ffmpeg: generateMasterPlaylist', () => {
  it.each([
    { fps: 30, expected: ',FRAME-RATE=30.000,' },
    { fps: undefined, expected: 'RESOLUTION=1280x720,CODECS=' },
  ])('states FRAME-RATE only when the probe measured one ($fps)', ({ fps, expected }) => {
    expect(generateMasterPlaylist({ ladder: [LADDER_720P], fps })).toContain(expected);
  });
});
