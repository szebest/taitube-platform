import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
  PostgresRepositories,
  S3MultipartStorage,
  S3StorageClient,
} from '../../adapters/index';
import type {
  CacheClient,
  FlowProducerPort,
  JobQueue,
  MultipartStorage,
  Repositories,
  StorageClient,
} from '../../core/ports/index';
import { mintToken } from '../../packages/server/dev-token/src/index';
import {
  type DlqCheckContext,
  auditDlqHostile,
  runAbandonedUploadTest,
  runForcedTransientDlqReplay,
} from './dlq-checks';
import { type InProcessEnv, setupInProcessEnv } from './in-process-env';
import { renderMarkdownReport } from './report-generator';
import {
  type E2ERunnerOptions,
  type E2ESuiteResult,
  type VideoTestResult,
  type VideoTestSpec,
  getSpecs,
} from './specs';
import { runSingleVideo } from './video-runner';

export type { VideoTestSpec, VideoTestResult, E2ERunnerOptions, E2ESuiteResult };

export class E2ERunner {
  private apiUrl?: string;
  private fixturesDir: string;
  private resultsDir: string;
  private reduced: boolean;
  private inProcessEnv?: InProcessEnv;

  repositories!: Repositories;
  storage!: StorageClient;
  multipart!: MultipartStorage;
  cache!: CacheClient;
  queuesMap = new Map<string, JobQueue>();
  flowProducer!: FlowProducerPort;

  readonly user1Id = '00000000-0000-7000-8000-000000000001';
  readonly user2Id = '00000000-0000-7000-8000-000000000002';
  readonly adminId = '00000000-0000-7000-8000-000000000099';

  user1Token!: string;
  user2Token!: string;
  adminToken!: string;

  private explicitResultsDir: boolean;

  constructor(options: E2ERunnerOptions = {}) {
    this.apiUrl = options.apiUrl;
    this.fixturesDir = options.fixturesDir || path.resolve(process.cwd(), 'tests/fixtures');
    this.resultsDir =
      options.resultsDir || path.resolve(process.cwd(), 'docs/load-tests/results/2026-09-05-e2e');
    this.explicitResultsDir = options.resultsDir !== undefined;
    this.reduced = Boolean(options.reduced);
  }

  async setup(): Promise<string> {
    this.user1Token = mintToken({ sub: this.user1Id, role: 'user' });
    this.user2Token = mintToken({ sub: this.user2Id, role: 'user' });
    this.adminToken = mintToken({ sub: this.adminId, role: 'admin' });

    if (this.apiUrl) {
      try {
        const res = await fetch(`${this.apiUrl}/healthz`);
        if (res.ok) {
          console.log(`[e2e-runner] Connected to API at ${this.apiUrl}`);
          this.repositories = process.env['DATABASE_URL']
            ? new PostgresRepositories()
            : new InMemoryRepositories();
          this.storage = process.env['S3_ENDPOINT']
            ? new S3StorageClient()
            : new InMemoryStorageClient();
          this.multipart = process.env['S3_ENDPOINT']
            ? new S3MultipartStorage()
            : new InMemoryMultipartStorage(this.storage);
          return this.apiUrl;
        }
      } catch {
        console.log(
          `[e2e-runner] API at ${this.apiUrl} unreachable; falling back to in-process stack`
        );
      }
    }

    this.inProcessEnv = await setupInProcessEnv();
    this.apiUrl = this.inProcessEnv.apiUrl;
    this.repositories = this.inProcessEnv.repositories;
    this.storage = this.inProcessEnv.storage;
    this.multipart = this.inProcessEnv.multipart;
    this.cache = this.inProcessEnv.cache;
    this.queuesMap = this.inProcessEnv.queuesMap;
    this.flowProducer = this.inProcessEnv.flowProducer;
    return this.apiUrl;
  }

  async teardown(): Promise<void> {
    if (this.inProcessEnv) await this.inProcessEnv.teardown();
  }

  getSpecs(): VideoTestSpec[] {
    return getSpecs(this.reduced, this.user2Id);
  }

  private getDlqContext(): DlqCheckContext {
    return {
      apiUrl: this.apiUrl || 'http://127.0.0.1:3000',
      adminToken: this.adminToken,
      user1Token: this.user1Token,
      adminId: this.adminId,
      fixturesDir: this.fixturesDir,
      repositories: this.repositories,
      storage: this.storage,
      multipart: this.multipart,
      specs: this.getSpecs(),
    };
  }

  async runForcedTransientDlqReplay() {
    return runForcedTransientDlqReplay(this.getDlqContext());
  }

  async runAbandonedUploadTest() {
    return runAbandonedUploadTest(this.getDlqContext());
  }

  async auditDlqHostile(videoResults?: VideoTestResult[]) {
    return auditDlqHostile(this.getDlqContext(), videoResults);
  }

  async runSingleVideo(spec: VideoTestSpec): Promise<VideoTestResult> {
    return runSingleVideo(
      {
        apiUrl: this.apiUrl || 'http://127.0.0.1:3000',
        fixturesDir: this.fixturesDir,
        user1Token: this.user1Token,
        user2Token: this.user2Token,
        user2Id: this.user2Id,
        repositories: this.repositories,
      },
      spec
    );
  }

  async executeSuite(): Promise<E2ESuiteResult> {
    const suiteStart = Date.now();
    await this.setup();

    const specs = this.getSpecs();
    console.log(`[e2e-runner] Launching ${specs.length} concurrent video uploads...`);
    const videoResults = await Promise.all(specs.map((spec) => this.runSingleVideo(spec)));
    console.log(`[e2e-runner] All ${videoResults.length} videos reached terminal states.`);

    const dlqReplayResult = await this.runForcedTransientDlqReplay();
    const abandonedUploadResult = await this.runAbandonedUploadTest();
    const dlqHostileAudit = await this.auditDlqHostile(videoResults);

    const totalTimeMs = Date.now() - suiteStart;
    const allPassed =
      videoResults.every((r) => r.passed) &&
      dlqReplayResult.passed &&
      abandonedUploadResult.passed &&
      dlqHostileAudit.passed;

    const markdownReport = renderMarkdownReport({
      videoResults,
      dlqReplayResult,
      abandonedUploadResult,
      dlqHostileAudit,
      allPassed,
      totalTimeMs,
    });

    const shouldWriteReport =
      process.env['WRITE_E2E_REPORT'] === 'true' ||
      (!this.reduced && (Boolean(process.env['FULL']) || this.explicitResultsDir));

    if (shouldWriteReport) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
      const reportPath = path.join(this.resultsDir, 'README.md');
      fs.writeFileSync(reportPath, markdownReport, 'utf-8');
      console.log(`[e2e-runner] Results written to ${reportPath}`);
    } else {
      console.log(
        `[e2e-runner] Skipping overwrite of benchmark report in ${this.resultsDir} (set WRITE_E2E_REPORT=true or run full suite to write)`
      );
    }

    await this.teardown();

    return {
      videoResults,
      dlqReplayResult,
      abandonedUploadResult,
      dlqHostileAudit,
      allPassed,
      totalTimeMs,
      markdownReport,
    };
  }
}
