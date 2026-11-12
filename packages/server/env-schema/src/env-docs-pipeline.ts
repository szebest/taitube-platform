import { groupDocs } from './env-doc';

export const PIPELINE_DOCS = groupDocs('pipeline', {
  WORKER_STAGE: {
    description:
      'Which pipeline stage this worker process runs: one image, one role per container. An unset value runs probe only, so the other stages never start.',
    example: 'transcode-720p',
    visibility: 'public',
    readBy: ['worker'],
  },
  WORKER_CONCURRENCY: {
    description:
      'How many jobs one worker runs at once. Empty uses the stage default from the registry; raising it past the CPU limit slows every job.',
    example: '2',
    visibility: 'public',
    readBy: ['worker'],
  },
  FFMPEG_PATH: {
    description:
      'The ffmpeg binary, resolved on PATH when relative. A missing binary fails every transcode and thumbnail job.',
    example: '/usr/bin/ffmpeg',
    visibility: 'public',
    readBy: ['worker'],
  },
  FFPROBE_PATH: {
    description:
      'The ffprobe binary, resolved on PATH when relative. A missing one fails the probe stage.',
    example: '/usr/bin/ffprobe',
    visibility: 'public',
    readBy: ['worker'],
  },
  FPCALC_PATH: {
    description:
      'The Chromaprint fpcalc binary for the audio fingerprint used by screening, resolved on PATH like FFMPEG_PATH.',
    example: '/usr/bin/fpcalc',
    visibility: 'public',
    readBy: ['worker'],
  },
  FFMPEG_THREADS: {
    description:
      'Threads per FFmpeg process. Set it to the container CPU limit: more oversubscribes the CPU, fewer wastes it.',
    example: '2',
    visibility: 'public',
    readBy: ['worker'],
  },
  X264_PRESET: {
    description:
      'The libx264 speed preset. Slower presets compress better and take longer, which pushes jobs toward their timeout.',
    example: 'veryfast',
    visibility: 'public',
    readBy: ['worker'],
  },
  HLS_SEGMENT_SECONDS: {
    description:
      'The HLS segment length in seconds. Keep it a multiple of GOP_SECONDS so every segment starts on a keyframe.',
    example: '6',
    visibility: 'public',
    readBy: ['worker'],
  },
  GOP_SECONDS: {
    description:
      'The keyframe interval in seconds, forced on every rendition. HLS_SEGMENT_SECONDS should be a multiple of it.',
    example: '2',
    visibility: 'public',
    readBy: ['worker'],
  },
  MAX_UPLOAD_BYTES: {
    description:
      'The largest file an upload may declare. The API refuses a bigger one when the upload starts.',
    example: '4294967296',
    visibility: 'public',
    readBy: ['api'],
  },
  MAX_DURATION_SEC: {
    description:
      'The longest video the probe stage accepts. A longer one fails permanently instead of being transcoded.',
    example: '3600',
    visibility: 'public',
    readBy: ['worker'],
  },
  JOB_TIMEOUT_FACTOR: {
    description:
      'A transcode hard timeout is max(this factor x the video duration, 10 minutes). Too low kills healthy jobs on slow hosts.',
    example: '3',
    visibility: 'public',
    readBy: ['worker'],
  },
  MAX_INFLIGHT_PER_USER: {
    description:
      'How many uploads one user may have processing at once. The next one is refused until one finishes.',
    example: '3',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  UPLOAD_RATE_LIMIT_MAX: {
    description: 'How many POST /v1/uploads one user may make per minute before getting 429.',
    example: '30',
    visibility: 'public',
    readBy: ['api'],
  },
  TMP_DIR: {
    description:
      'The scratch directory for downloads and FFmpeg output. It needs room for several source files; a full disk fails the running job.',
    example: '/tmp/vp',
    visibility: 'public',
    readBy: ['worker'],
  },
  SSE_HEARTBEAT_MS: {
    description:
      'How often an SSE stream sends a keep-alive comment. Longer than the proxy idle timeout and the proxy drops the stream.',
    example: '15000',
    visibility: 'public',
    readBy: ['api'],
  },
  SSE_MAX_PER_USER: {
    description:
      'The most SSE streams one user may hold open. A new one over the cap is refused, which bites users with many tabs.',
    example: '20',
    visibility: 'public',
    readBy: ['api'],
  },
  SSE_MAX_PER_POD: {
    description:
      'The most SSE streams one API pod serves. Over the cap new streams are refused so one pod does not run out of sockets.',
    example: '5000',
    visibility: 'public',
    readBy: ['api'],
  },
  SPRITE_INTERVAL_SECONDS: {
    description:
      'The seconds between frames in the hover-preview sprite. Changing it only affects videos processed afterwards.',
    example: '5',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  WORKER_HEARTBEAT_PATH: {
    description:
      'The file the worker touches for its liveness probe. If the probe reads another path the pod is restarted as dead.',
    example: '/tmp/vp/heartbeat',
    visibility: 'public',
    readBy: ['worker', 'infra'],
  },
  CAPTIONS_ENABLED: {
    description:
      'The platform kill switch for speech-to-text captions. false queues no captions job and skips the captions reconcile.',
    example: 'true',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  WHISPER_PATH: {
    description:
      'The whisper.cpp binary, resolved on PATH like FFMPEG_PATH. A missing one fails the captions stage.',
    example: 'whisper-cli',
    visibility: 'public',
    readBy: ['worker', 'tooling'],
  },
  CAPTIONS_MODEL_PATH: {
    description:
      'The whisper model file. pnpm models:fetch fills .models/ and the image bakes it in; a missing file fails the captions stage.',
    example: '.models/ggml-small-q5_1.bin',
    visibility: 'public',
    readBy: ['worker', 'tooling'],
  },
  CAPTIONS_VAD_MODEL_PATH: {
    description:
      'The voice-activity-detection model whisper uses to skip silence. A missing file fails the captions stage.',
    example: '.models/ggml-silero-v5.1.2.bin',
    visibility: 'public',
    readBy: ['worker', 'tooling'],
  },
  CAPTIONS_THREADS: {
    description: 'Threads for whisper. Set it to the captions container CPU limit.',
    example: '4',
    visibility: 'public',
    readBy: ['worker'],
  },
  SCREENING_ENABLED: {
    description:
      'The platform kill switch for upload screening. false runs no screen job and holds nothing for review.',
    example: 'true',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  SCREENING_MODEL_PATH: {
    description:
      'The ONNX image classifier the screen stage loads. pnpm models:fetch fills .models/ and the image bakes it in; a missing file fails the screen stage.',
    example: '.models/vit-base-nsfw-detector-int8.onnx',
    visibility: 'public',
    readBy: ['worker'],
  },
});
