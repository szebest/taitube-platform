import { fromPromise, isOk, tryCatch } from '@vp/result';

interface ParamLike {
  setValueAtTime(value: number, at: number): unknown;
  exponentialRampToValueAtTime(value: number, at: number): unknown;
}

interface GainLike {
  gain: ParamLike;
  connect(destination: unknown): unknown;
}

interface OscillatorLike {
  type: OscillatorType;
  frequency: ParamLike;
  onended: ((event: Event) => void) | null;
  connect(destination: unknown): unknown;
  start(at: number): void;
  stop(at: number): void;
}

/** The part of an `AudioContext` the chime draws on, so a spec can hand in a fake. */
export interface ChimeContext {
  readonly state: AudioContextState;
  readonly currentTime: number;
  readonly destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  resume(): PromiseLike<unknown>;
  close(): unknown;
}

const NOTES = [
  { hz: 880, offset: 0 },
  { hz: 1318.5, offset: 0.15 },
] as const;
const NOTE_SECONDS = 0.35;
const ATTACK_SECONDS = 0.02;
const PEAK_GAIN = 0.2;
const SILENT_GAIN = 0.0001;

/** Two rising sine notes with a short envelope, synthesised so nothing is fetched. Silent, and the context closed, where audio is unavailable or the browser keeps it suspended. */
export async function playChime(
  open: () => ChimeContext = () => new AudioContext()
): Promise<void> {
  const opened = tryCatch(open, (cause) => cause);
  if (!isOk(opened)) {
    return;
  }

  const context = opened.value;
  const resumed = await fromPromise(context.resume(), (cause) => cause);
  if (!isOk(resumed) || context.state !== 'running') {
    void context.close();
    return;
  }

  const start = context.currentTime;
  const oscillators = NOTES.map(({ hz, offset }) => {
    const at = start + offset;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(hz, at);
    envelope.gain.setValueAtTime(SILENT_GAIN, at);
    envelope.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + ATTACK_SECONDS);
    envelope.gain.exponentialRampToValueAtTime(SILENT_GAIN, at + NOTE_SECONDS);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + NOTE_SECONDS);
    return oscillator;
  });

  const last = oscillators.at(-1);
  if (last) {
    last.onended = () => context.close();
  }
}
