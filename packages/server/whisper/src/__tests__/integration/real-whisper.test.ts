import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expectOk } from '@vp/testing/result';
import { runWhisper } from '../../run-whisper';

const MODELS = resolve(__dirname, '../../../../../../.models');
const MODEL = process.env.CAPTIONS_MODEL_PATH ?? join(MODELS, 'ggml-small-q5_1.bin');
const VAD = process.env.CAPTIONS_VAD_MODEL_PATH ?? join(MODELS, 'ggml-silero-v5.1.2.bin');
const WHISPER = process.env.WHISPER_PATH ?? 'whisper-cli';
const SPOKEN =
  'The quick brown fox jumps over the lazy dog. Captions make every video easier to follow.';


function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z' ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Word error rate: word-level edit distance over the reference length. */
function wordErrorRate(reference: string[], hypothesis: string[]): number {
  let previous = Array.from({ length: hypothesis.length + 1 }, (_, j) => j);
  for (let i = 1; i <= reference.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= hypothesis.length; j += 1) {
      const substitution =
        (previous[j - 1] ?? 0) + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1);
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution));
    }
    previous = current;
  }
  return (previous[hypothesis.length] ?? 0) / reference.length;
}

/**
 * Needs whisper-cli, the pinned models (`pnpm models:fetch`) and macOS `say` for the spoken clip, so
 * it runs by hand: `pnpm --filter @vp/whisper test:real-engine`.
 */
describe('@vp/whisper: the real engine', () => {
  it('transcribes a spoken clip within a word error rate of 0.25 and detects its language', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vp-real-whisper-'));
    try {
      execFileSync('say', ['-o', join(dir, 'speech.aiff'), SPOKEN]);
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-i',
        join(dir, 'speech.aiff'),
        '-ac',
        '1',
        '-ar',
        '16000',
        join(dir, 'speech.wav'),
      ]);

      const transcript = expectOk(
        await runWhisper({
          whisperPath: WHISPER,
          modelPath: MODEL,
          vadModelPath: VAD,
          inputPath: join(dir, 'speech.wav'),
          outputBase: join(dir, 'transcript'),
          threads: 4,
          language: null,
          timeoutMs: 120_000,
          killGraceMs: 1000,
          stderrTailLines: 20,
          niceness: 19,
        })
      );

      const heard = transcript.cues.map((cue) => cue.text).join(' ');
      expect(transcript.language).toBe('en');
      expect(wordErrorRate(words(SPOKEN), words(heard))).toBeLessThanOrEqual(0.25);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
