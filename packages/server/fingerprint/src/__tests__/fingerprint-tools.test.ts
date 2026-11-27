import { sampleClassifierFrames } from '../decode-classifier-frames';
import { extractEvidenceFrame } from '../evidence-frame';
import { fingerprintTools } from '../fingerprint-tools';
import { runFpcalc } from '../fpcalc';
import { sampleFrames } from '../sample-frames';

describe('@vp/fingerprint: fingerprintTools', () => {
  it('is the real processes, so a stage built over it spawns them', () => {
    expect(fingerprintTools).toEqual({
      sampleFrames,
      runFpcalc,
      sampleClassifierFrames,
      extractEvidenceFrame,
    });
  });
});
