import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { type WhisperRunOptions, runWhisper } from '../run-whisper';

const TRANSCRIPT = JSON.stringify({
  result: { language: 'en' },
  transcription: [{ offsets: { from: 0, to: 1500 }, text: ' Hello.' }],
});

/** Stands in for whisper-cli: reads `--output-file` from its arguments and acts out `$MODE`. */
const FAKE_WHISPER = `#!/bin/sh
out=""
while [ $# -gt 0 ]; do
  if [ "$1" = "--output-file" ]; then out="$2"; fi
  shift
done
case "$(cat "$(dirname "$0")/mode")" in
  ok) printf '%s' '${TRANSCRIPT}' > "$out.json" ;;
  model) echo "error: failed to initialize whisper context" >&2; exit 3 ;;
  unreadable) echo "error: failed to read audio file" >&2; exit 0 ;;
  hang) sleep 5 ;;
esac
`;

describe('@vp/whisper: runWhisper', () => {
  let dir: string;
  let options: WhisperRunOptions;

  const act = (mode: string) => writeFile(join(dir, 'mode'), mode);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vp-whisper-'));
    await writeFile(join(dir, 'whisper'), FAKE_WHISPER);
    await chmod(join(dir, 'whisper'), 0o755);
    await writeFile(join(dir, 'model.bin'), 'model');
    await writeFile(join(dir, 'vad.bin'), 'vad');
    options = {
      whisperPath: join(dir, 'whisper'),
      modelPath: join(dir, 'model.bin'),
      vadModelPath: join(dir, 'vad.bin'),
      inputPath: join(dir, 'audio.wav'),
      outputBase: join(dir, 'transcript'),
      threads: 1,
      language: null,
      timeoutMs: 2000,
      killGraceMs: 100,
      stderrTailLines: 20,
      niceness: undefined,
    };
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it.each([{ niceness: undefined }, { niceness: 19 }])(
    'reads the transcript whisper wrote (niceness $niceness)',
    async ({ niceness }) => {
      await act('ok');

      expect(expectOk(await runWhisper({ ...options, niceness }))).toEqual({
        language: 'en',
        cues: [{ startMs: 0, endMs: 1500, text: 'Hello.' }],
      });
    }
  );

  it.each([
    { mode: 'model', timeoutMs: 2000, code: ErrorCodes.WHISPER_MODEL_INVALID },
    { mode: 'unreadable', timeoutMs: 2000, code: ErrorCodes.WHISPER_INPUT_REJECTED },
    { mode: 'hang', timeoutMs: 300, code: ErrorCodes.WHISPER_TIMEOUT },
  ])('classifies a $mode run as $code', async ({ mode, timeoutMs, code }) => {
    await act(mode);

    expect(expectErr(await runWhisper({ ...options, timeoutMs })).code).toBe(code);
  });

  it('stops whisper when the step lease is lost', async () => {
    await act('hang');
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    expect(expectErr(await runWhisper({ ...options, signal: controller.signal })).code).toBe(
      ErrorCodes.WHISPER_KILLED
    );
  });

  it('refuses to start without its model files', async () => {
    await rm(options.vadModelPath);

    expect(expectErr(await runWhisper(options)).code).toBe(ErrorCodes.WHISPER_MODEL_INVALID);
  });
});
