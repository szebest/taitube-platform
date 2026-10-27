#!/bin/sh
# Fails unless the worker-captions container holds whisper-cli and both models at the paths its env names, and
# whisper runs a transcription there. Takes the compose files the stack was started with, the offline override
# among them.
set -eu

files=""
for file in "$@"; do files="$files -f $file"; done

# shellcheck disable=SC2086
docker compose $files exec -T worker-captions sh -ec '
  test -f "$CAPTIONS_MODEL_PATH"
  test -f "$CAPTIONS_VAD_MODEL_PATH"
  command -v nice >/dev/null
  "$WHISPER_PATH" --help >/dev/null 2>&1
  ffmpeg -loglevel error -y -f lavfi -i anullsrc=r=16000:cl=mono -t 1 /tmp/vp/captions-smoke.wav
  nice -n 19 "$WHISPER_PATH" -m "$CAPTIONS_MODEL_PATH" --vad --vad-model "$CAPTIONS_VAD_MODEL_PATH" \
    -t "$CAPTIONS_THREADS" -nt -f /tmp/vp/captions-smoke.wav >/dev/null 2>&1
  rm -f /tmp/vp/captions-smoke.wav
'
echo "Verified: worker-captions runs whisper-cli offline with both models."
