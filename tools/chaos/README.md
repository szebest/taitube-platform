# Chaos & Resilience Tooling (SDD §14.4)

This directory provides lightweight, focused chaos testing scripts for validating the resilience guarantees of `video-pipeline` under faults, as specified in SDD §9.5, §9.6, and §14.4.

## Tools Overview

| Script | Purpose | Supported Modes | Usage Example |
|---|---|---|---|
| `kill-worker.sh` | Terminates a random worker of a given stage every $N$ seconds | Docker Compose (`docker kill -s KILL`) and Kubernetes (`kubectl delete pod`) | `./tools/chaos/kill-worker.sh transcode-720p 45` |
| `redis-restart.sh` | Restarts Redis instance mid-execution to verify AOF persistence and ioredis reconnection | Docker Compose & Kubernetes | `./tools/chaos/redis-restart.sh` |
| `disk-fill.sh` | Fills `/tmp/vp` temporary storage to trigger `ENOSPC` and the `WorkerTmpDiskHigh` alert | Docker Compose & Kubernetes & Host | `./tools/chaos/disk-fill.sh 7000 transcode-720p`<br/>`./tools/chaos/disk-fill.sh --cleanup transcode-720p` |
| `toxiproxy-toxic.sh` | Configures latency, timeouts, and outages via Toxiproxy fronting MinIO | Docker Compose | `./tools/chaos/toxiproxy-toxic.sh latency 2000`<br/>`./tools/chaos/toxiproxy-toxic.sh reset` |

## Toxiproxy Setup

Toxiproxy runs as a Docker Compose service under the `chaos` profile:

```bash
make toxiproxy-up
```

- API Endpoint: `http://localhost:8474`
- Upstream MinIO Proxy: `http://localhost:9002` (routes to `minio:9000`)
- When running storage chaos scenarios, configure `S3_ENDPOINT=http://localhost:9002` (or in Compose `S3_ENDPOINT=http://toxiproxy:9002`).

### Toxics Reference

- **Inject 2s Latency**: `./tools/chaos/toxiproxy-toxic.sh latency 2000 500`
- **Simulate Complete S3 Outage (503 / connection drop)**: `./tools/chaos/toxiproxy-toxic.sh disable`
- **Restore Normal Traffic**: `./tools/chaos/toxiproxy-toxic.sh reset`
