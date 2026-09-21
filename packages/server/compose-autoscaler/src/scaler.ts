/**
 * Configuration for an individual worker stage's autoscaling rules.
 */
export interface ScalerStageConfig {
  minReplicas: number;
  maxReplicas: number;
  threshold: number;
  cooldownSeconds: number;
}

/**
 * Ephemeral scaling state tracked per stage across polling intervals.
 */
export interface StageScalingState {
  currentReplicas: number;
  lastScaleDownTimeMs: number;
  scaleDownCandidateSinceMs: number | null;
}

/**
 * Queue depth breakdown parsed from metrics.
 */
export interface QueueDepth {
  waiting: number;
  prioritized: number;
  active: number;
  completed?: number;
  failed?: number;
  delayed?: number;
}

/**
 * Result of the pure computeReplicas decision function.
 */
export interface ScalingDecision {
  targetReplicas: number;
  action: 'scale_up' | 'scale_down' | 'hold';
  reason: string;
  nextState: StageScalingState;
}

/**
 * Parameters passed to computeReplicas.
 */
export interface ComputeReplicasParams {
  config: ScalerStageConfig;
  state: StageScalingState;
  queueDepth: QueueDepth;
  nowMs: number;
}

/**
 * Default autoscaler configuration for video-pipeline worker stages.
 * Matching KEDA ScaledObject parameters from SDD §13.2.
 */
export const DEFAULT_STAGE_CONFIGS: Record<string, ScalerStageConfig> = {
  'worker-probe': {
    minReplicas: 0,
    maxReplicas: 4,
    threshold: 1,
    cooldownSeconds: 300,
  },
  'worker-transcode-1080p': {
    minReplicas: 0,
    maxReplicas: 6,
    threshold: 1,
    cooldownSeconds: 300,
  },
  'worker-transcode-720p': {
    minReplicas: 0,
    maxReplicas: 6,
    threshold: 1,
    cooldownSeconds: 300,
  },
  'worker-transcode-480p': {
    minReplicas: 0,
    maxReplicas: 6,
    threshold: 1,
    cooldownSeconds: 300,
  },
  'worker-thumbnail': {
    minReplicas: 0,
    maxReplicas: 4,
    threshold: 1,
    cooldownSeconds: 300,
  },
  'worker-package': {
    minReplicas: 0,
    maxReplicas: 4,
    threshold: 1,
    cooldownSeconds: 300,
  },
  'worker-notify': {
    minReplicas: 0,
    maxReplicas: 4,
    threshold: 1,
    cooldownSeconds: 300,
  },
  'worker-housekeeping': {
    minReplicas: 0,
    maxReplicas: 2,
    threshold: 1,
    cooldownSeconds: 300,
  },
};

/**
 * Pure decision function computing desired replica count based on:
 * - Outstanding jobs (waiting + prioritized + active)
 * - Threshold per replica (concurrency 1 = 1 job/pod)
 * - minReplicas and maxReplicas bounds
 * - Active job safety (never scale below currently active jobs)
 * - Cooldown stabilization window before scaling down
 */
export function computeReplicas(params: ComputeReplicasParams): ScalingDecision {
  const { config, state, queueDepth, nowMs } = params;
  const { minReplicas, maxReplicas, threshold, cooldownSeconds } = config;

  const outstandingJobs =
    (queueDepth.waiting || 0) + (queueDepth.prioritized || 0) + (queueDepth.active || 0);

  // Raw desired calculation based on outstanding jobs and threshold
  const rawDesired = Math.ceil(outstandingJobs / Math.max(1, threshold));

  // Bound rawDesired between minReplicas and maxReplicas
  let desired = Math.max(minReplicas, Math.min(maxReplicas, rawDesired));

  // Invariant: Never scale below active jobs while active jobs are running
  const activeCount = queueDepth.active || 0;
  if (desired < activeCount) {
    desired = Math.min(maxReplicas, Math.max(minReplicas, activeCount));
  }

  const current = state.currentReplicas;

  // Case 1: Scale UP
  if (desired > current) {
    return {
      targetReplicas: desired,
      action: 'scale_up',
      reason: `Backlog increased (${outstandingJobs} outstanding): scaled up from ${current} to ${desired}`,
      nextState: {
        currentReplicas: desired,
        lastScaleDownTimeMs: state.lastScaleDownTimeMs,
        scaleDownCandidateSinceMs: null, // Reset scale-down cooldown
      },
    };
  }

  // Case 2: Scale DOWN
  if (desired < current) {
    const candidateSince = state.scaleDownCandidateSinceMs ?? nowMs;
    const cooldownMs = cooldownSeconds * 1000;
    const elapsed = nowMs - candidateSince;

    if (elapsed >= cooldownMs) {
      return {
        targetReplicas: desired,
        action: 'scale_down',
        reason: `Cooldown period elapsed (${Math.round(elapsed / 1000)}s >= ${cooldownSeconds}s): scaled down from ${current} to ${desired}`,
        nextState: {
          currentReplicas: desired,
          lastScaleDownTimeMs: nowMs,
          scaleDownCandidateSinceMs: null,
        },
      };
    }

    // Cooldown active -> Hold current replicas
    const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
    return {
      targetReplicas: current,
      action: 'hold',
      reason: `Holding ${current} replicas during scale-down cooldown (${remainingSec}s remaining before reducing to ${desired})`,
      nextState: {
        ...state,
        scaleDownCandidateSinceMs: candidateSince,
      },
    };
  }

  // Case 3: Steady state (desired === current)
  return {
    targetReplicas: current,
    action: 'hold',
    reason: `Steady state at ${current} replicas`,
    nextState: {
      currentReplicas: current,
      lastScaleDownTimeMs: state.lastScaleDownTimeMs,
      scaleDownCandidateSinceMs: null,
    },
  };
}

/**
 * Parses Prometheus exposition text format to extract `bullmq_queue_jobs{queue="...", state="..."}` gauges.
 */
export function parsePrometheusQueueMetrics(prometheusText: string): Record<string, QueueDepth> {
  const result: Record<string, QueueDepth> = {};
  const lines = prometheusText.split('\n');

  // Regex matches lines like: bullmq_queue_jobs{queue="transcode-1080p",state="waiting"} 15
  const metricRegex =
    /^bullmq_queue_jobs\{(?=[^}]*queue="([^"]+)")(?=[^}]*state="([^"]+)")(?:[^}]*)\}\s+([0-9.e+-]+)/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = metricRegex.exec(line);
    if (!match) continue;

    const queue = match[1];
    const state = match[2];
    const val = Number.parseFloat(match[3] ?? '0');

    if (!(queue && state)) continue;

    if (!result[queue]) {
      result[queue] = {
        waiting: 0,
        prioritized: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }

    const qDepth = result[queue];
    if (state === 'waiting') qDepth.waiting = val;
    else if (state === 'prioritized') qDepth.prioritized = val;
    else if (state === 'active') qDepth.active = val;
    else if (state === 'completed') qDepth.completed = val;
    else if (state === 'failed') qDepth.failed = val;
    else if (state === 'delayed') qDepth.delayed = val;
  }

  return result;
}
