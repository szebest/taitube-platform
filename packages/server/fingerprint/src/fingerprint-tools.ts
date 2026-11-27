import { sampleClassifierFrames } from './decode-classifier-frames';
import { extractEvidenceFrame } from './evidence-frame';
import { runFpcalc } from './fpcalc';
import { sampleFrames } from './sample-frames';

/**
 * The processes the `screen` stage spawns, as one value the composition root hands it, like
 * `MediaTools`: a spec fails the stage by handing it a double, not by spying on the module.
 */
export interface FingerprintTools {
  sampleFrames: typeof sampleFrames;
  runFpcalc: typeof runFpcalc;
  sampleClassifierFrames: typeof sampleClassifierFrames;
  extractEvidenceFrame: typeof extractEvidenceFrame;
}

export const fingerprintTools: FingerprintTools = {
  sampleFrames,
  runFpcalc,
  sampleClassifierFrames,
  extractEvidenceFrame,
};
