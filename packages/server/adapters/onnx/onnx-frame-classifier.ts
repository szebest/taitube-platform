import { FrameClassifier, type FrameScores, RGB_CHANNELS, type RgbFrame } from '@vp/core/ports';
import type { ScreeningModelTuning } from '@vp/env-schema';
import { ErrorCodes, type MediaFailure, mediaFailure } from '@vp/errors';
import { type Result, assertNever, err, fromPromise, isErr, map, ok } from '@vp/result';
import type { InferenceSession, Tensor } from 'onnxruntime-node';
import { packFrames } from './frame-tensor';
import { verifyModelFile } from './model-file';

const STAGE = 'screen';

interface Loaded {
  session: InferenceSession;
  TensorClass: typeof Tensor;
}

export interface OnnxFrameClassifierOptions {
  modelPath: string;
  model: ScreeningModelTuning;
}

function softmax(logits: readonly number[]): number[] {
  const peak = Math.max(...logits);
  const exps = logits.map((logit) => Math.exp(logit - peak));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

/**
 * Runs a pinned image classifier on the CPU with `onnxruntime-node`, the only place that package is
 * imported. The addon is loaded on first use and the file is checked against its pinned SHA-256 before
 * the session opens, so a process that never screens never loads either.
 */
export class OnnxFrameClassifier extends FrameClassifier {
  readonly modelVersion: string;
  readonly inputSize: number;
  private loading: Promise<Result<Loaded, MediaFailure>> | undefined;

  constructor(private readonly options: OnnxFrameClassifierOptions) {
    super();
    this.modelVersion = options.model.name;
    this.inputSize = options.model.inputSize;
  }

  /** Verifies the model and opens the session, so a damaged model stops the worker before a job. */
  async start(): Promise<Result<void, MediaFailure>> {
    return map(await this.load(), () => undefined);
  }

  async close(): Promise<void> {
    const loaded = await this.loading;
    if (loaded?.ok) await loaded.value.session.release();
  }

  async classify(frames: readonly RgbFrame[]): Promise<Result<FrameScores[], MediaFailure>> {
    const loaded = await this.load();
    if (isErr(loaded)) return loaded;

    const scores: FrameScores[] = [];
    for (let from = 0; from < frames.length; from += this.options.model.batchSize) {
      const batch = await this.classifyBatch(
        loaded.value,
        frames.slice(from, from + this.options.model.batchSize)
      );
      if (isErr(batch)) return batch;
      scores.push(...batch.value);
    }
    return ok(scores);
  }

  private load(): Promise<Result<Loaded, MediaFailure>> {
    this.loading ??= this.open();
    return this.loading;
  }

  private async open(): Promise<Result<Loaded, MediaFailure>> {
    const verified = await verifyModelFile(this.options.modelPath, this.options.model.sha256);
    if (isErr(verified)) return verified;

    const invalid = (cause: unknown) =>
      mediaFailure(
        STAGE,
        ErrorCodes.SCREEN_MODEL_INVALID,
        `The screening model cannot be loaded: ${(cause as Error).message}`
      );
    const ort = await fromPromise(() => import('onnxruntime-node'), invalid);
    if (isErr(ort)) return ort;
    const session = await fromPromise(
      () =>
        ort.value.InferenceSession.create(this.options.modelPath, {
          intraOpNumThreads: this.options.model.intraOpThreads,
        }),
      invalid
    );
    if (isErr(session)) return session;
    return ok({ session: session.value, TensorClass: ort.value.Tensor });
  }

  private async classifyBatch(
    { session, TensorClass }: Loaded,
    frames: readonly RgbFrame[]
  ): Promise<Result<FrameScores[], MediaFailure>> {
    const { inputSize, mean, std } = this.options.model;
    const packed = packFrames(frames, { inputSize, mean, std });
    if (isErr(packed)) return packed;

    const [inputName] = session.inputNames;
    const [outputName] = session.outputNames;
    if (!(inputName && outputName)) {
      return err(
        mediaFailure(
          STAGE,
          ErrorCodes.SCREEN_MODEL_INVALID,
          'The screening model has no input or output'
        )
      );
    }

    const output = await fromPromise(
      () =>
        session.run({
          [inputName]: new TensorClass('float32', packed.value, [
            frames.length,
            RGB_CHANNELS,
            inputSize,
            inputSize,
          ]),
        }),
      (cause) =>
        mediaFailure(
          STAGE,
          ErrorCodes.SCREEN_MODEL_FAILED,
          `The screening model failed: ${(cause as Error).message}`
        )
    );
    if (isErr(output)) return output;

    const logits = output.value[outputName];
    return logits
      ? this.scoresOf(Array.from(logits.data as ArrayLike<number>), frames.length)
      : err(mediaFailure(STAGE, ErrorCodes.SCREEN_MODEL_FAILED, `The model gave no ${outputName}`));
  }

  private scoresOf(
    flat: readonly number[],
    frameCount: number
  ): Result<FrameScores[], MediaFailure> {
    const { labels, activation } = this.options.model;
    const width = flat.length / frameCount;
    if (!Number.isInteger(width) || Object.values(labels).some((index) => index >= width)) {
      return err(
        mediaFailure(
          STAGE,
          ErrorCodes.SCREEN_MODEL_FAILED,
          `The model gave ${flat.length} values for ${frameCount} frames, fewer than its labels need`
        )
      );
    }

    return ok(
      Array.from({ length: frameCount }, (_, frame) => {
        const row = flat.slice(frame * width, (frame + 1) * width);
        const values = applyActivation(row, activation);
        return Object.fromEntries(
          Object.entries(labels).map(([label, index]) => [label, values[index] ?? 0])
        );
      })
    );
  }
}

function applyActivation(row: readonly number[], activation: ScreeningModelTuning['activation']) {
  switch (activation) {
    case 'softmax':
      return softmax(row);
    case 'none':
      return row;
    default:
      return assertNever(activation, 'activation');
  }
}
