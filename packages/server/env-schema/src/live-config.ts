import { LIVE_GATEWAY_TIMEOUT_MS, LIVE_PACKAGING } from './tuning';

export type LivePackaging = typeof LIVE_PACKAGING;

export interface LiveConfig {
  /** Absent refuses every gateway call: an ingest nobody configured accepts no publisher. */
  hookSecret: string | undefined;
  ingestUrl: string;
  gatewayApiUrl: string;
  gatewayTimeoutMs: number;
  rtmpPublicUrl: string;
  whipPublicUrl: string;
  packaging: LivePackaging;
}

/** The live keys as `toAppConfig` read them, given the packaging and gateway tuning. */
export function liveConfig(keys: Omit<LiveConfig, 'gatewayTimeoutMs' | 'packaging'>): LiveConfig {
  return { ...keys, gatewayTimeoutMs: LIVE_GATEWAY_TIMEOUT_MS, packaging: LIVE_PACKAGING };
}
