#!/bin/sh
# Fails unless the worker-screen container holds fpcalc and the pinned classifier at the path its env names,
# the model's SHA-256 is the one the lock file pins, and the classifier scores a frame there. Takes the compose
# files the stack was started with, the offline override among them.
set -eu

files=""
for file in "$@"; do files="$files -f $file"; done
expected=$(sed -n 's/^SCREENING_MODEL_SHA256=//p' apps/server/worker/screening.lock)

# shellcheck disable=SC2086
docker compose $files exec -T -e EXPECTED_SHA256="$expected" worker-screen sh -ec '
  test -f "$SCREENING_MODEL_PATH"
  test "$(sha256sum "$SCREENING_MODEL_PATH" | cut -d" " -f1)" = "$EXPECTED_SHA256"
  fpcalc -version >/dev/null
  ffmpeg -loglevel error -y -f lavfi -i sine=frequency=440:duration=2 -c:a pcm_s16le /tmp/vp/screening-smoke.wav
  fpcalc -raw -json /tmp/vp/screening-smoke.wav | grep -q "\"fingerprint\""
  rm -f /tmp/vp/screening-smoke.wav
  ${WORKER_RUNTIME:-bun} -e "
    import(\"onnxruntime-node\").then(async (ort) => {
      const session = await ort.InferenceSession.create(process.env.SCREENING_MODEL_PATH);
      const input = new ort.Tensor(\"float32\", new Float32Array(3 * 384 * 384), [1, 3, 384, 384]);
      const output = await session.run({ [session.inputNames[0]]: input });
      process.exit(output[session.outputNames[0]].data.length === 2 ? 0 : 1);
    }).catch(() => process.exit(1));
  "
'
echo "Verified: worker-screen runs fpcalc and the pinned classifier offline."
