#!/usr/bin/env bun
import { E2ERunner } from '../tests/e2e/e2e-runner';

async function main() {
  const args = process.argv.slice(2);
  const reduced = args.includes('--reduced') || process.env['E2E_REDUCED'] === 'true';
  const apiUrl = process.env['API_URL'];

  console.log('================================================================');
  console.log('==> Starting Phase 2 E2E Acceptance Suite');
  console.log(`==> Mode: ${reduced ? 'Reduced set (CI)' : 'Full 20-video concurrent suite'}`);
  if (apiUrl) console.log(`==> Target API URL: ${apiUrl}`);
  console.log('================================================================');

  const runner = new E2ERunner({
    apiUrl,
    reduced,
  });

  const result = await runner.executeSuite();

  console.log('================================================================');
  if (result.allPassed) {
    console.log(
      `==> PHASE 2 E2E SUITE PASSED SUCCESSFULLY in ${(result.totalTimeMs / 1000).toFixed(1)}s!`
    );
    console.log('================================================================');
    process.exit(0);
  } else {
    console.error(`==> PHASE 2 E2E SUITE FAILED after ${(result.totalTimeMs / 1000).toFixed(1)}s`);
    const failedVideos = result.videoResults.filter((r) => !r.passed);
    for (const f of failedVideos) {
      console.error(`  - [${f.spec.name}] ${f.failureReason}`);
    }
    if (!result.dlqReplayResult.passed) {
      console.error('  - DLQ forced-transient replay failed');
    }
    if (!result.abandonedUploadResult.passed) {
      console.error('  - Abandoned upload reconciler cleanup failed');
    }
    if (!result.dlqHostileAudit.passed) {
      console.error('  - Hostile files DLQ audit failed');
    }
    console.log('================================================================');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
