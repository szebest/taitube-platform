import type { ViewDate } from './views';

export const VIEW_DEVICES = ['desktop', 'mobile', 'tablet', 'unknown'] as const;
export type ViewDevice = (typeof VIEW_DEVICES)[number];

export interface DeviceViewCount {
  readonly videoId: string;
  readonly viewDate: ViewDate;
  readonly device: ViewDevice;
  readonly views: number;
}

export interface DeviceViews {
  readonly device: ViewDevice;
  readonly views: number;
}

export function mergeDeviceCounts(counts: readonly DeviceViewCount[]): DeviceViewCount[] {
  const merged = new Map<string, DeviceViewCount>();
  for (const count of counts) {
    const key = `${count.videoId}|${count.viewDate}|${count.device}`;
    const held = merged.get(key);
    merged.set(key, held ? { ...held, views: held.views + count.views } : count);
  }
  return [...merged.values()];
}
