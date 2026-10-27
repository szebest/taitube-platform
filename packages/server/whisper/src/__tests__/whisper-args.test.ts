import { buildWhisperArgs } from '../whisper-args';

describe('@vp/whisper: whisper-cli arguments', () => {
  const options = {
    modelPath: '/opt/whisper/ggml-small-q5_1.bin',
    vadModelPath: '/opt/whisper/ggml-silero-v5.1.2.bin',
    inputPath: '/tmp/vp/w0/audio.wav',
    outputBase: '/tmp/vp/w0/transcript',
    threads: 4,
  };

  it.each([
    { language: null, passed: 'auto' },
    { language: 'pl', passed: 'pl' },
  ])('asks for $passed when the hint is $language', ({ language, passed }) => {
    const args = buildWhisperArgs({ ...options, language });

    expect(args[args.indexOf('--language') + 1]).toBe(passed);
  });

  it('writes JSON next to the scratch audio, with VAD on and the thread count of the pod', () => {
    expect(buildWhisperArgs({ ...options, language: null })).toEqual([
      '--model',
      options.modelPath,
      '--file',
      options.inputPath,
      '--threads',
      '4',
      '--language',
      'auto',
      '--vad',
      '--vad-model',
      options.vadModelPath,
      '--output-json',
      '--output-file',
      options.outputBase,
      '--no-prints',
    ]);
  });
});
