import { check, sleep } from 'k6';
// tests/load/s4-worker-kills.js — S4: Worker node failure recovery & effectively-once guarantees (SDD §14.2)
import { SharedArray } from 'k6/data';
import { Counter, Trend } from 'k6/metrics';
import { STORAGE_HOSTS, completeUpload, getVideo, initUpload, uploadPart } from './common.js';

const videoData = new SharedArray('video-s60', () => {
  return open('../fixtures/s60.mp4', 'b');
});

const videoReadyDuration = new Trend('video_ready_duration_seconds');
const readyVideosCount = new Counter('ready_videos_total');

export const options = {
  hosts: STORAGE_HOSTS,
  scenarios: {
    worker_kills: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 50,
      maxDuration: '25m', // Allow 50 videos to complete while worker kills occur
    },
  },
  thresholds: {
    'http_req_duration{name:presign}': ['p(95)<1000'],
    'http_req_duration{name:complete}': ['p(95)<1000'],
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
  },
};

const PART_SIZE = 8 * 1024 * 1024; // 8 MB chunks

export default function () {
  const startTime = Date.now();

  const init = initUpload({
    filename: 's60.mp4',
    sizeBytes: videoData.byteLength,
    contentType: 'video/mp4',
    strategy: 'multipart',
  });

  const uploadId = init.uploadId;
  const parts = init.parts || [];
  const partsExpected = init.partsExpected || parts.length;
  const etags = [];

  for (let i = 0; i < partsExpected; i++) {
    const start = i * PART_SIZE;
    const end = Math.min(start + PART_SIZE, videoData.byteLength);
    const chunk = videoData.slice(start, end);

    const partInfo = parts.find((p) => p.partNumber === i + 1);
    if (!partInfo) {
      throw new Error(`Missing presigned URL for part ${i + 1}`);
    }
    const result = uploadPart(partInfo.url, chunk, i + 1);
    etags.push(result);
  }

  const completeRes = completeUpload(uploadId, etags);
  const videoId = completeRes.videoId;

  check(videoId, {
    'videoId present in complete response': (v) => !!v,
  });

  // Under chaos kills, BullMQ stalled detection takes up to 120s + re-encode time
  let status = 'PROCESSING';
  let attempts = 0;
  const maxAttempts = 180; // 180 * 5s = 15 minutes max wait per video

  while (status !== 'READY' && status !== 'FAILED' && attempts < maxAttempts) {
    sleep(5);
    attempts++;
    try {
      const video = getVideo(videoId);
      status = video.status;
    } catch (_err) {
      // transient connection error during restart/kill
    }
  }

  const isReady = status === 'READY';
  check(status, {
    'video reached READY state': () => isReady,
  });

  if (isReady) {
    readyVideosCount.add(1);
    videoReadyDuration.add((Date.now() - startTime) / 1000);
  }
}
