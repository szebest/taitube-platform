import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Span } from './cue-alignment';

export interface PlacedUtterance extends Span {
  sentence: number;
}

const SENTENCES = [
  'The quick brown fox jumps over the lazy dog.',
  'Captions make every video easier to follow.',
  'Please remember to subscribe and share this video with your friends.',
  'Today we are going to look at how a transcoding pipeline splits a long video into small chunks.',
  'The weather forecast for tomorrow shows light rain in the morning and sunshine in the afternoon.',
  'A good microphone matters more than an expensive camera.',
  'Every window of audio overlaps its neighbour by a few seconds.',
  'Thank you for watching, and see you in the next episode.',
];

const SAMPLE_RATE = 16_000;
const BYTES_PER_MS = (SAMPLE_RATE * 2) / 1000;

/** Sentences cycle one after another, each preceded by `gapMs` of silence and followed by room for one more. */
export function placeUtterances(
  durationsMs: readonly number[],
  gapMs: number,
  totalMs: number
): PlacedUtterance[] {
  const placed: PlacedUtterance[] = [];
  let startMs = gapMs;
  for (let count = 0; ; count += 1) {
    const sentence = count % durationsMs.length;
    const endMs = startMs + (durationsMs[sentence] ?? 0);
    if (endMs + gapMs > totalMs) return placed;
    placed.push({ sentence, startMs, endMs });
    startMs = endMs + gapMs;
  }
}

/** macOS `say` speech, trimmed of its own leading and trailing silence, as 16 kHz mono PCM. */
function speak(text: string, dir: string, index: number): Buffer {
  const aiff = join(dir, `${index}.aiff`);
  execFileSync('say', ['-o', aiff, text]);
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB';
  return execFileSync(
    'ffmpeg',
    [
      ...['-v', 'error', '-i', aiff, '-ac', '1', '-ar', String(SAMPLE_RATE)],
      ...['-af', `${trim},areverse,${trim},areverse`, '-f', 's16le', '-'],
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  );
}

function main(): void {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: resolve(import.meta.dirname, '../tests/fixtures') },
      id: { type: 'string', default: 'c12' },
      minutes: { type: 'string', default: '12' },
      'gap-ms': { type: 'string', default: '3000' },
    },
  });
  const totalMs = Number(values.minutes) * 60_000;
  const gapMs = Number(values['gap-ms']);
  const work = mkdtempSync(join(tmpdir(), 'vp-speech-fixture-'));
  try {
    const speech = SENTENCES.map((text, index) => speak(text, work, index));
    const placed = placeUtterances(
      speech.map((pcm) => Math.round(pcm.length / BYTES_PER_MS)),
      gapMs,
      totalMs
    );
    const pcm = Buffer.alloc(totalMs * BYTES_PER_MS);
    for (const { sentence, startMs } of placed) {
      speech[sentence]?.copy(pcm, startMs * BYTES_PER_MS);
    }
    const rawPath = join(work, 'speech.pcm');
    writeFileSync(rawPath, pcm);

    mkdirSync(values.out, { recursive: true });
    const video = join(values.out, `${values.id}.mp4`);
    execFileSync('ffmpeg', [
      ...[
        '-v',
        'error',
        '-y',
        '-f',
        's16le',
        '-ar',
        String(SAMPLE_RATE),
        '-ac',
        '1',
        '-i',
        rawPath,
      ],
      ...['-f', 'lavfi', '-i', 'color=c=black:s=640x360:r=24'],
      ...['-t', String(totalMs / 1000), '-c:v', 'libx264', '-preset', 'ultrafast'],
      ...['-c:a', 'aac', '-ar', '48000', '-movflags', '+faststart', video],
    ]);
    const truth = join(values.out, `${values.id}.truth.json`);
    writeFileSync(
      truth,
      `${JSON.stringify(
        placed.map(({ startMs, endMs }) => ({ startMs, endMs })),
        null,
        2
      )}\n`
    );
    process.stdout.write(
      `${video}: ${placed.length} utterances over ${values.minutes} minutes\n${truth}\n`
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) main();
