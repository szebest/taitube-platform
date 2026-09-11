import { check, sleep } from 'k6';
// tests/load/s5-dependency-outage.js — S5: Dependency outage & recovery (SDD §14.2, §9.5, §9.6)
import { SharedArray } from 'k6/data';
import { Counter, Trend } from 'k6/metrics';
import { completeUpload, getVideo, initUpload, uploadPart } from './common.js';

const videoData = new SharedArray('video-s15', () => {
  return open('../fixtures/s15.mp4', 'b');
});

const recoveryDuration = new Trend('outage_recovery_duration_seconds');
const retryObservedCount = new Counter('retries_observed_total');

export const options = {
  scenarios: {
    dependency_outage: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 30, // 30 videos in flight
      maxDuration: '20m',
    },
  },
  thresholds: {
    'http_req_duration{name:presign}': ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

const PART_SIZE = 8 * 1024 * 1024;

export default function () {
  const startTime = Date.now();

  // 1. Initiate upload
  let init;
  try {
    init = initUpload({
      filename: 's15.mp4',
      sizeBytes: videoData.byteLength,
      contentType: 'video/mp4',
      strategy: 'multipart',
    });
  } catch (_err) {
    // If storage/API outage is active, retry with backoff
    retryObservedCount.add(1);
    sleep(2);
    init = initUpload({
      filename: 's15.mp4',
      sizeBytes: videoData.byteLength,
      contentType: 'video/mp4',
      strategy: 'multipart',
    });
  }

  const uploadId = init.uploadId;
  const parts = init.parts || [];
  const partsExpected = init.partsExpected || parts.length;
  const etags = [];

  // 2. Upload parts
  for (let i = 0; i < partsExpected; i++) {
    const start = i * PART_SIZE;
    const end = Math.min(start + PART_SIZE, videoData.byteLength);
    const chunk = videoData.slice(start, end);
    const partInfo = parts.find((p) => p.partNumber === i + 1);

    let res;
    try {
      res = uploadPart(partInfo.url, chunk, i + 1);
    } catch (_e) {
      retryObservedCount.add(1);
      sleep(3);
      res = uploadPart(partInfo.url, chunk, i + 1);
    }
    etags.push(res);
  }

  // 3. Complete upload
  let completeRes;
  try {
    completeRes = completeUpload(uploadId, etags);
  } catch (_e) {
    retryObservedCount.add(1);
    sleep(3);
    completeRes = completeUpload(uploadId, etags);
  }

  const videoId = completeRes.videoId;
  check(videoId, {
    'videoId present in completed upload': (v) => !!v,
  });

  // 4. Poll until video is terminal
  // Under outage/restart conditions, workers retry with backoff: 10s, 20s, 40s
  let status = 'PROCESSING';
  let pollAttempts = 0;
  const maxPolls = 120; // 120 * 5s = 10 minutes

  while (status !== 'READY' && status !== 'FAILED' && pollAttempts < maxPolls) {
    sleep(5);
    pollAttempts++;
    try {
      const video = getVideo(videoId);
      status = video.status;
    } catch (_err) {
      // transient connection failure during Redis/storage blip
    }
  }

  const isTerminal = status === 'READY' || status === 'FAILED';
  check(status, {
    'video reached terminal state after dependency recovery': () => isTerminal,
  });

  if (status === 'READY') {
    recoveryDuration.add((Date.now() - startTime) / 1000);
  }
}
