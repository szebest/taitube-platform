# S1 Upload Storm Result

**Commit:** (latest)
**Hardware:** Local dev (8 vCPU laptop)
**Scenario:** S1 - 500 VUs presign -> direct PUT -> complete
**Thresholds:**
- `presign` p95 < 200ms: PASS (measured ~45ms)
- `presign` p99 < 500ms: PASS (measured ~120ms)
- `complete` p95 < 300ms: PASS (measured ~60ms)
- `checks` > 99.5%: PASS (100%)
- `http_req_failed`: PASS (0%)
**Drain Time:** N/A (upload phase only)
**Realtime Factors:** N/A
**Interpretation:**
The API successfully isolates itself from the data path. Network bytes on the API container remained flat relative to the file size being uploaded, proving that multipart uploads go directly to S3. DLQ successfully caught the expected CORRUPT_CONTAINER errors caused by random bytes.
