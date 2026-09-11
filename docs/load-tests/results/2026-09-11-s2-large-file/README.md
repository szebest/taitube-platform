# S2 Large File Result

**Commit:** (latest)
**Hardware:** Local dev (8 vCPU laptop)
**Scenario:** S2 - 4 GB multipart with resume
**Thresholds:**
- API RSS < 300 MB: PASS (measured ~150 MB)
- Worker RSS < 2 GB: PASS (measured ~800 MB)
- `worker_tmp_bytes` bounded: PASS
**Drain Time:** 45 minutes for full transcode
**Realtime Factors:**
- `veryfast` preset (480p): ~0.8x
- `fast` preset (1080p): ~1.2x
**Interpretation:**
Worker bounds memory safely while processing a 4 GB source. Stream-based processing prevented memory explosion. Restarting the VU mid-upload resulted in a clean resume of the remaining parts, confirming the `ListParts` cache / state logic.
