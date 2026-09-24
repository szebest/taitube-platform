import { check, sleep } from 'k6';
// tests/load/s7-soak.js — S7: Extended soak test for memory leaks, disk hygiene & scheduler drift (SDD §14.2)
import { SharedArray } from 'k6/data';
import { Counter, Trend } from 'k6/metrics';
import { STORAGE_HOSTS, completeUpload, getVideo, initUpload, uploadPart } from './common.js';

const videoData = new SharedArray('video-s60', () => {
  return open('../fixtures/s60.mp4', 'b');
});

const soakVideoDuration = new Trend('soak_video_processing_duration');
const completedVideos = new Counter('soak_completed_videos_total');

// Default is 4 hours as specified in SDD §14.2, can be overridden via SOAK_DURATION env var
const SOAK_DURATION = __ENV.SOAK_DURATION || '4h';

export const options = {
  hosts: STORAGE_HOSTS,
  scenarios: {
    soak_steady: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '10s', // 1 upload every 10 seconds
      duration: SOAK_DURATION,
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
  thresholds: {
    'http_req_duration{name:presign}': ['p(95)<500'],
    'http_req_duration{name:complete}': ['p(95)<500'],
    checks: ['rate>0.99'],
    http_req_failed: ['rate==0'],
  },
};

const PART_SIZE = 8 * 1024 * 1024;

export default function () {
  const startTime = Date.now();

  const init = initUpload({
    filename: 'soak-s60.mp4',
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
    const result = uploadPart(partInfo.url, chunk, i + 1);
    etags.push(result);
  }

  const completeRes = completeUpload(uploadId, etags);
  const videoId = completeRes.videoId;

  check(videoId, {
    'soak videoId generated': (v) => !!v,
  });

  let status = 'PROCESSING';
  let polls = 0;
  const maxPolls = 120; // 10 minutes max wait per 60s video

  while (status !== 'READY' && status !== 'FAILED' && polls < maxPolls) {
    sleep(5);
    polls++;
    try {
      const video = getVideo(videoId);
      status = video.status;
    } catch (_e) {
      // transient network blip
    }
  }

  const reachedReady = status === 'READY';
  check(status, {
    'soak video successfully completed to READY': () => reachedReady,
  });

  if (reachedReady) {
    completedVideos.add(1);
    soakVideoDuration.add((Date.now() - startTime) / 1000);
  }
}
