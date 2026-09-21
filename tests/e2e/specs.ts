import { ErrorCodes } from '../../packages/universal/errors/src/index';

export interface VideoTestSpec {
  name: string;
  fixtureFile: string;
  durationSec: number;
  expectedLadder: string[];
  expectedSegments: number;
  strategy: 'single' | 'multipart';
  expectedStatus: 'READY' | 'FAILED';
  expectedErrorCode?: string;
  userId?: string;
}

export interface VideoTestResult {
  spec: VideoTestSpec;
  videoId: string;
  uploadId: string;
  terminalStatus: string;
  errorCode?: string;
  renditionCount: number;
  renditions: string[];
  segmentCount: number;
  posterKey?: string;
  spriteKey?: string;
  playbackUrl?: string;
  eventCount: number;
  sseEvents: string[];
  firstPlayableMs: number;
  totalDurationMs: number;
  passed: boolean;
  failureReason?: string;
}

export interface E2ERunnerOptions {
  apiUrl?: string;
  fixturesDir?: string;
  resultsDir?: string;
  reduced?: boolean;
}

export interface E2ESuiteResult {
  videoResults: VideoTestResult[];
  dlqReplayResult: {
    passed: boolean;
    dlqEntryId: string;
    replayJobId: string;
    finalStatus: string;
  };
  abandonedUploadResult: {
    passed: boolean;
    videoId: string;
    uploadId: string;
    finalStatus: string;
    uploadStatus: string;
  };
  dlqHostileAudit: {
    passed: boolean;
    entriesFound: number;
    expectedHostileCount: number;
    allParkedWithAttempt1: boolean;
  };
  allPassed: boolean;
  totalTimeMs: number;
  markdownReport: string;
}

export function getSpecs(reduced = false, user2Id?: string): VideoTestSpec[] {
  if (reduced) {
    return [
      {
        name: 's15-single',
        fixtureFile: 's15.mp4',
        durationSec: 15,
        expectedLadder: ['1080p', '720p', '480p'],
        expectedSegments: 3,
        strategy: 'single',
        expectedStatus: 'READY',
      },
      {
        name: 'p720-multi',
        fixtureFile: 'p720.mp4',
        durationSec: 15,
        expectedLadder: ['720p', '480p'],
        expectedSegments: 3,
        strategy: 'multipart',
        expectedStatus: 'READY',
      },
      {
        name: 'hostile-truncated',
        fixtureFile: 'truncated.mp4',
        durationSec: 5,
        expectedLadder: [],
        expectedSegments: 0,
        strategy: 'single',
        expectedStatus: 'FAILED',
        expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
      },
      {
        name: 'hostile-bad-codec',
        fixtureFile: 'bad-codec.mov',
        durationSec: 1,
        expectedLadder: [],
        expectedSegments: 0,
        strategy: 'single',
        expectedStatus: 'FAILED',
        expectedErrorCode: ErrorCodes.UNSUPPORTED_CODEC,
      },
    ];
  }

  return [
    {
      name: 's15-single',
      fixtureFile: 's15.mp4',
      durationSec: 15,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 3,
      strategy: 'single',
      expectedStatus: 'READY',
    },
    {
      name: 's15-multi',
      fixtureFile: 's15.mp4',
      durationSec: 15,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 3,
      strategy: 'multipart',
      expectedStatus: 'READY',
    },
    {
      name: 's60-single',
      fixtureFile: 's60.mp4',
      durationSec: 60,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 10,
      strategy: 'single',
      expectedStatus: 'READY',
    },
    {
      name: 's60-multi',
      fixtureFile: 's60.mp4',
      durationSec: 60,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 10,
      strategy: 'multipart',
      expectedStatus: 'READY',
    },
    {
      name: 'p720-single',
      fixtureFile: 'p720.mp4',
      durationSec: 15,
      expectedLadder: ['720p', '480p'],
      expectedSegments: 3,
      strategy: 'single',
      expectedStatus: 'READY',
    },
    {
      name: 'p720-multi',
      fixtureFile: 'p720.mp4',
      durationSec: 15,
      expectedLadder: ['720p', '480p'],
      expectedSegments: 3,
      strategy: 'multipart',
      expectedStatus: 'READY',
    },
    {
      name: 'sd360-single',
      fixtureFile: 'sd360.mp4',
      durationSec: 15,
      expectedLadder: ['480p'],
      expectedSegments: 3,
      strategy: 'single',
      expectedStatus: 'READY',
    },
    {
      name: 'sd360-multi',
      fixtureFile: 'sd360.mp4',
      durationSec: 15,
      expectedLadder: ['480p'],
      expectedSegments: 3,
      strategy: 'multipart',
      expectedStatus: 'READY',
    },
    {
      name: 'portrait-single',
      fixtureFile: 'portrait.mp4',
      durationSec: 15,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 3,
      strategy: 'single',
      expectedStatus: 'READY',
    },
    {
      name: 'portrait-multi',
      fixtureFile: 'portrait.mp4',
      durationSec: 15,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 3,
      strategy: 'multipart',
      expectedStatus: 'READY',
    },
    {
      name: 'vfr-single',
      fixtureFile: 'vfr.mp4',
      durationSec: 15,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 3,
      strategy: 'single',
      expectedStatus: 'READY',
    },
    {
      name: 'vfr-multi',
      fixtureFile: 'vfr.mp4',
      durationSec: 15,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 3,
      strategy: 'multipart',
      expectedStatus: 'READY',
    },
    {
      name: 'k60-multi',
      fixtureFile: 'k60.mp4',
      durationSec: 10,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 2,
      strategy: 'multipart',
      expectedStatus: 'READY',
    },
    {
      name: 's15-user2-single',
      fixtureFile: 's15.mp4',
      durationSec: 15,
      expectedLadder: ['1080p', '720p', '480p'],
      expectedSegments: 3,
      strategy: 'single',
      expectedStatus: 'READY',
      userId: user2Id,
    },
    {
      name: 'p720-user2-multi',
      fixtureFile: 'p720.mp4',
      durationSec: 15,
      expectedLadder: ['720p', '480p'],
      expectedSegments: 3,
      strategy: 'multipart',
      expectedStatus: 'READY',
      userId: user2Id,
    },
    {
      name: 'hostile-truncated',
      fixtureFile: 'truncated.mp4',
      durationSec: 5,
      expectedLadder: [],
      expectedSegments: 0,
      strategy: 'single',
      expectedStatus: 'FAILED',
      expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      name: 'hostile-audio-only',
      fixtureFile: 'audio-only.mp4',
      durationSec: 5,
      expectedLadder: [],
      expectedSegments: 0,
      strategy: 'single',
      expectedStatus: 'FAILED',
      expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      name: 'hostile-zero-bytes',
      fixtureFile: 'zero-bytes.mp4',
      durationSec: 0,
      expectedLadder: [],
      expectedSegments: 0,
      strategy: 'single',
      expectedStatus: 'FAILED',
      expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      name: 'hostile-not-video',
      fixtureFile: 'not-a-video.mp4',
      durationSec: 0,
      expectedLadder: [],
      expectedSegments: 0,
      strategy: 'single',
      expectedStatus: 'FAILED',
      expectedErrorCode: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      name: 'hostile-bad-codec',
      fixtureFile: 'bad-codec.mov',
      durationSec: 1,
      expectedLadder: [],
      expectedSegments: 0,
      strategy: 'single',
      expectedStatus: 'FAILED',
      expectedErrorCode: ErrorCodes.UNSUPPORTED_CODEC,
    },
  ];
}
