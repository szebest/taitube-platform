import { type Logger, createLogger } from '../packages/server/logger/src/index';
import { E2ERunner } from '../tests/e2e/e2e-runner';

async function main(log: Logger) {
  const args = process.argv.slice(2);
  const reduced = args.includes('--reduced') || process.env['E2E_REDUCED'] === 'true';
  const apiUrl = process.env['API_URL'];

  log.info({ reduced, apiUrl }, 'starting e2e acceptance suite');

  const runner = new E2ERunner({ apiUrl, reduced }, log);
  const result = await runner.executeSuite();

  if (result.allPassed) {
    log.info({ totalTimeMs: result.totalTimeMs }, 'e2e suite passed');
    process.exit(0);
  }

  log.error({ totalTimeMs: result.totalTimeMs }, 'e2e suite failed');
  const failedVideos = result.videoResults.filter((r) => !r.passed);
  for (const failed of failedVideos) {
    log.error({ spec: failed.spec.name, reason: failed.failureReason }, 'video spec failed');
  }
  if (!result.dlqReplayResult.passed) {
    log.error('dlq forced-transient replay failed');
  }
  if (!result.abandonedUploadResult.passed) {
    log.error('abandoned upload reconciler cleanup failed');
  }
  if (!result.dlqHostileAudit.passed) {
    log.error('hostile files dlq audit failed');
  }
  process.exit(1);
}

const log = createLogger({ service: 'run-e2e', level: 'info', format: 'pretty' });

main(log).catch((err) => {
  log.error({ err }, 'e2e suite crashed');
  process.exit(1);
});
