import { captionsConfig, modelVersionOf } from '../captions-config';

describe('packages/env-schema: captions config', () => {
  it.each([
    { path: '/opt/whisper/ggml-small-q5_1.bin', version: 'small-q5_1' },
    { path: '.models/ggml-base.bin', version: 'base' },
    { path: 'model.bin', version: 'model' },
  ])('names the captions model $version after $path', ({ path, version }) => {
    expect(modelVersionOf(path)).toBe(version);
  });

  it('names the run after the model the image carries', () => {
    const keys = {
      enabled: false,
      whisperPath: 'whisper-cli',
      modelPath: '/opt/whisper/ggml-base.bin',
      vadModelPath: '/opt/whisper/ggml-silero-v5.1.2.bin',
      threads: 4,
    };

    expect(captionsConfig(keys)).toMatchObject({ ...keys, modelVersion: 'base' });
  });
});
