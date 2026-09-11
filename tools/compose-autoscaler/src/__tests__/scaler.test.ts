import { describe, expect, it } from 'vitest';
import {
  type ScalerStageConfig,
  type StageScalingState,
  computeReplicas,
  parsePrometheusQueueMetrics,
} from '../scaler.js';

describe('Compose Autoscaler - computeReplicas decision function', () => {
  const defaultConfig: ScalerStageConfig = {
    minReplicas: 0,
    maxReplicas: 6,
    threshold: 1,
    cooldownSeconds: 300,
  };

  const emptyState: StageScalingState = {
    currentReplicas: 0,
    lastScaleDownTimeMs: 0,
    scaleDownCandidateSinceMs: null,
  };

  it('scales up when backlog > threshold', () => {
    const result = computeReplicas({
      config: defaultConfig,
      state: emptyState,
      queueDepth: { waiting: 3, prioritized: 0, active: 0 },
      nowMs: 1000,
    });

    // 3 outstanding jobs / threshold 1 = 3 replicas
    expect(result.targetReplicas).toBe(3);
    expect(result.action).toBe('scale_up');
    expect(result.reason).toContain('scaled up');
  });

  it('bounds target replicas by maxReplicas', () => {
    const result = computeReplicas({
      config: defaultConfig,
      state: emptyState,
      queueDepth: { waiting: 20, prioritized: 5, active: 0 },
      nowMs: 1000,
    });

    // 25 outstanding jobs capped at maxReplicas = 6
    expect(result.targetReplicas).toBe(6);
    expect(result.action).toBe('scale_up');
  });

  it('never scales below minReplicas', () => {
    const minConfig: ScalerStageConfig = {
      ...defaultConfig,
      minReplicas: 2,
    };

    const result = computeReplicas({
      config: minConfig,
      state: {
        currentReplicas: 1,
        lastScaleDownTimeMs: 0,
        scaleDownCandidateSinceMs: null,
      },
      queueDepth: { waiting: 0, prioritized: 0, active: 0 },
      nowMs: 1000,
    });

    // Even with 0 backlog, must be at least minReplicas (2)
    expect(result.targetReplicas).toBe(2);
    expect(result.action).toBe('scale_up');
  });

  it('never scales below active count while active jobs are running', () => {
    const result = computeReplicas({
      config: defaultConfig,
      state: {
        currentReplicas: 4,
        lastScaleDownTimeMs: 0,
        scaleDownCandidateSinceMs: 0,
      },
      // 0 waiting, but 3 active jobs running
      queueDepth: { waiting: 0, prioritized: 0, active: 3 },
      nowMs: 400_000, // Long past cooldown
    });

    // Desired would be 3 (from active), which is >= active count (3).
    // It must NOT scale below 3.
    expect(result.targetReplicas).toBe(3);
    expect(result.targetReplicas).toBeGreaterThanOrEqual(3);
  });

  it('respects cooldown period before scaling down', () => {
    // Current replicas = 4, backlog drops to 0 at t = 1000
    const t0 = 1000;
    const runningState: StageScalingState = {
      currentReplicas: 4,
      lastScaleDownTimeMs: 0,
      scaleDownCandidateSinceMs: null,
    };

    // First cycle seeing backlog = 0
    const step1 = computeReplicas({
      config: defaultConfig,
      state: runningState,
      queueDepth: { waiting: 0, prioritized: 0, active: 0 },
      nowMs: t0,
    });

    // Should hold replicas during cooldown
    expect(step1.targetReplicas).toBe(4);
    expect(step1.action).toBe('hold');
    expect(step1.nextState.scaleDownCandidateSinceMs).toBe(t0);

    // 100 seconds later (cooldown is 300s) -> still hold
    const step2 = computeReplicas({
      config: defaultConfig,
      state: step1.nextState,
      queueDepth: { waiting: 0, prioritized: 0, active: 0 },
      nowMs: t0 + 100_000,
    });
    expect(step2.targetReplicas).toBe(4);
    expect(step2.action).toBe('hold');

    // 301 seconds later -> cooldown expired, scales down to min (0)
    const step3 = computeReplicas({
      config: defaultConfig,
      state: step2.nextState,
      queueDepth: { waiting: 0, prioritized: 0, active: 0 },
      nowMs: t0 + 301_000,
    });
    expect(step3.targetReplicas).toBe(0);
    expect(step3.action).toBe('scale_down');
    expect(step3.nextState.currentReplicas).toBe(0);
  });

  it('resets cooldown timer if backlog reappears during cooldown', () => {
    const t0 = 1000;
    const cooldownState: StageScalingState = {
      currentReplicas: 3,
      lastScaleDownTimeMs: 0,
      scaleDownCandidateSinceMs: t0,
    };

    // Backlog reappears at t0 + 100s
    const result = computeReplicas({
      config: defaultConfig,
      state: cooldownState,
      queueDepth: { waiting: 3, prioritized: 0, active: 0 },
      nowMs: t0 + 100_000,
    });

    // Replicas match backlog (3), candidate cooldown timer reset to null
    expect(result.targetReplicas).toBe(3);
    expect(result.nextState.scaleDownCandidateSinceMs).toBeNull();
  });
});

describe('Prometheus Queue Metrics Parser', () => {
  const samplePrometheusText = `
# HELP bullmq_queue_jobs Number of jobs in queue by state
# TYPE bullmq_queue_jobs gauge
bullmq_queue_jobs{queue="transcode-1080p",state="waiting"} 15
bullmq_queue_jobs{queue="transcode-1080p",state="prioritized"} 2
bullmq_queue_jobs{queue="transcode-1080p",state="active"} 3
bullmq_queue_jobs{queue="transcode-720p",state="waiting"} 5
bullmq_queue_jobs{queue="transcode-720p",state="active"} 1
bullmq_queue_jobs{queue="transcode-480p",state="completed"} 40
bullmq_queue_jobs{queue="probe",state="waiting"} 0
`;

  it('parses Prometheus metrics into per-queue state counts', () => {
    const parsed = parsePrometheusQueueMetrics(samplePrometheusText);

    expect(parsed['transcode-1080p']).toEqual({
      waiting: 15,
      prioritized: 2,
      active: 3,
      completed: 0,
      failed: 0,
      delayed: 0,
    });

    expect(parsed['transcode-720p']).toEqual({
      waiting: 5,
      prioritized: 0,
      active: 1,
      completed: 0,
      failed: 0,
      delayed: 0,
    });

    expect(parsed['transcode-480p']?.completed).toBe(40);
  });
});
