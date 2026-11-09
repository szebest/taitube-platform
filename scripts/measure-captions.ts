import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildWhisperArgs } from '../packages/server/whisper/src/whisper-args';
import { compareCues, type Span } from './cue-alignment';

const ROOT = resolve(import.meta.dirname, '..');
const READY_LIMIT_SECONDS = { 3: 360, 1: 720 } as const;
const ISOLATION_TOLERANCE = 0.05;

export const realtimeFactor = (audioMs: number, wallMs: number): number => audioMs / wallMs;

export function readyVerdict(seconds: number, pods: 1 | 3): { limit: number; passes: boolean } {
  const limit = READY_LIMIT_SECONDS[pods];
  return { limit, passes: seconds <= limit };
}

export function isolationVerdict(
  runningP95: number,
  pausedP95: number
): { ratio: number; passes: boolean } {
  const ratio = runningP95 / pausedP95;
  return { ratio, passes: ratio <= 1 + ISOLATION_TOLERANCE + Number.EPSILON };
}

/** The series the pipeline dashboard plots, rewritten to read one measured window. */
export function promQueries(window: string) {
  return {
    realtimeFactor: `histogram_quantile(0.5, sum(rate(captions_realtime_factor_bucket[${window}])) by (le))`,
    timeToReady: `sum(increase(captions_time_to_ready_seconds_sum[${window}])) / sum(increase(captions_time_to_ready_seconds_count[${window}]))`,
    readyCount: `sum(increase(captions_time_to_ready_seconds_count[${window}]))`,
    transcodeP95: `histogram_quantile(0.95, sum(rate(job_duration_seconds_bucket{queue="transcode-720p"}[${window}])) by (le))`,
  };
}

export async function queryScalar(
  prometheus: string,
  query: string,
  atSeconds: number,
  fetchFn: typeof fetch = fetch
): Promise<number> {
  const url = `${prometheus}/api/v1/query?query=${encodeURIComponent(query)}&time=${atSeconds}`;
  const body = (await (await fetchFn(url)).json()) as {
    data?: { result?: { value: [number, string] }[] };
  };
  const value = Number(body.data?.result?.[0]?.value[1]);
  if (!Number.isFinite(value)) throw new Error(`${query} matched no series at ${atSeconds}`);
  return value;
}

function line(label: string, value: string, query?: string): void {
  process.stdout.write(`${label}: ${value}${query ? `\n  promql: ${query}` : ''}\n`);
}

function whisperRun(values: {
  audio: string;
  seconds?: string;
  threads: string;
  whisper: string;
  model: string;
  vad: string;
  gpu: boolean;
  truth?: string;
  'tolerance-ms': string;
  keep?: string;
}): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'vp-measure-captions-'));
  try {
    const wav = join(dir, 'audio.wav');
    const limit = values.seconds ? ['-t', values.seconds] : [];
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-i', values.audio, ...limit],
      ...['-vn', '-ac', '1', '-ar', '16000', wav],
    ]);
    const audioMs =
      Number(
        execFileSync(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav],
          { encoding: 'utf8' }
        )
      ) * 1000;
    const outputBase = join(dir, 'transcript');
    const args = buildWhisperArgs({
      modelPath: values.model,
      vadModelPath: values.vad,
      inputPath: wav,
      outputBase,
      threads: Number(values.threads),
      language: null,
    });
    const started = performance.now();
    const ran = spawnSync(values.whisper, [...args, ...(values.gpu ? [] : ['--no-gpu'])], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    const wallMs = performance.now() - started;
    if (ran.status !== 0) throw new Error(`${values.whisper} exited ${ran.status}`);

    const factor = realtimeFactor(audioMs, wallMs);
    line('audio', `${(audioMs / 1000).toFixed(1)} s from ${values.audio}`);
    line(
      'whisper wall clock',
      `${(wallMs / 1000).toFixed(1)} s at ${values.threads} threads, ${values.gpu ? 'GPU allowed' : 'CPU only'}`
    );
    line('real-time factor', `${factor.toFixed(2)} (limit 1.0 or better)`);

    if (!values.truth) return factor >= 1;
    if (values.keep) copyFileSync(`${outputBase}.json`, values.keep);
    const { transcription } = JSON.parse(readFileSync(`${outputBase}.json`, 'utf8')) as {
      transcription: { offsets: { from: number; to: number }; text: string }[];
    };
    const cues = transcription
      .filter((segment) => segment.text.trim() !== '')
      .map(({ offsets }) => ({ startMs: offsets.from, endMs: offsets.to }));
    const truth = (JSON.parse(readFileSync(values.truth, 'utf8')) as Span[]).filter(
      (span) => span.endMs <= audioMs
    );
    const report = compareCues(truth, cues, Number(values['tolerance-ms']));
    line(
      'cue alignment',
      `${report.cues} cues over ${report.utterances} utterances, max start ${report.maxStartDeviationMs} ms, max end ${report.maxEndDeviationMs} ms, tolerance ${values['tolerance-ms']} ms`
    );
    for (const failure of report.failures) line('  misaligned', failure);
    return factor >= 1 && report.failures.length === 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function cluster(values: {
  prometheus: string;
  pods: string;
  window: string;
}): Promise<boolean> {
  const queries = promQueries(values.window);
  const now = Math.floor(Date.now() / 1000);
  const pods = Number(values.pods);
  if (pods !== 1 && pods !== 3) throw new Error('--pods is 1 or 3');

  const factor = await queryScalar(values.prometheus, queries.realtimeFactor, now);
  line(
    'real-time factor p50',
    `${factor.toFixed(2)} (limit 1.0 or better)`,
    queries.realtimeFactor
  );
  const count = await queryScalar(values.prometheus, queries.readyCount, now);
  const seconds = await queryScalar(values.prometheus, queries.timeToReady, now);
  const verdict = readyVerdict(seconds, pods);
  line(
    `time to ready, ${pods} pod(s)`,
    `${seconds.toFixed(0)} s mean over ${count.toFixed(0)} track(s), limit ${verdict.limit} s: ${verdict.passes ? 'PASS' : 'FAIL'}`,
    queries.timeToReady
  );
  return factor >= 1 && verdict.passes;
}

async function p95Over(prometheus: string, span: string): Promise<number> {
  const [start, end] = span.split(',').map((time) => Date.parse(time) / 1000);
  if (start === undefined || end === undefined || !(end > start)) {
    throw new Error(`${span} is not <start>,<end> as ISO times`);
  }
  return queryScalar(prometheus, promQueries(`${Math.round(end - start)}s`).transcodeP95, end);
}

async function isolation(values: {
  prometheus: string;
  running: string;
  paused: string;
}): Promise<boolean> {
  const running = await p95Over(values.prometheus, values.running);
  const paused = await p95Over(values.prometheus, values.paused);
  const verdict = isolationVerdict(running, paused);
  line(
    'transcode-720p p95, captions running',
    `${running.toFixed(2)} s`,
    promQueries('<window>').transcodeP95
  );
  line('transcode-720p p95, captions queue paused', `${paused.toFixed(2)} s`);
  line('ratio', `${verdict.ratio.toFixed(3)} (limit 1.05): ${verdict.passes ? 'PASS' : 'FAIL'}`);
  return verdict.passes;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      audio: { type: 'string', default: resolve(ROOT, 'tests/fixtures/c12.mp4') },
      seconds: { type: 'string' },
      threads: { type: 'string', default: '4' },
      whisper: { type: 'string', default: process.env.WHISPER_PATH ?? 'whisper-cli' },
      model: {
        type: 'string',
        default: process.env.CAPTIONS_MODEL_PATH ?? resolve(ROOT, '.models/ggml-small-q5_1.bin'),
      },
      vad: {
        type: 'string',
        default:
          process.env.CAPTIONS_VAD_MODEL_PATH ?? resolve(ROOT, '.models/ggml-silero-v5.1.2.bin'),
      },
      gpu: { type: 'boolean', default: false },
      truth: { type: 'string' },
      keep: { type: 'string' },
      'tolerance-ms': { type: 'string', default: '100' },
      prometheus: {
        type: 'string',
        default: process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
      },
      pods: { type: 'string', default: '3' },
      window: { type: 'string', default: '1h' },
      running: { type: 'string', default: '' },
      paused: { type: 'string', default: '' },
    },
  });
  const [command] = positionals;
  const passes =
    command === 'whisper'
      ? whisperRun(values)
      : command === 'cluster'
        ? await cluster(values)
        : command === 'isolation'
          ? await isolation(values)
          : undefined;
  if (passes === undefined) {
    process.stderr.write('usage: measure-captions.ts whisper | cluster | isolation\n');
    process.exit(2);
  }
  process.exit(passes ? 0 : 1);
}

if (import.meta.main) await main();
