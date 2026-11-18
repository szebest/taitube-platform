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

export interface DeviceShare extends DeviceViews {
  readonly share: number;
}

/** Each device's part of the counted views, in the order given; every share is 0 while nothing is counted. */
export function deviceShares(devices: readonly DeviceViews[]): DeviceShare[] {
  const total = devices.reduce((sum, { views }) => sum + views, 0);
  return devices.map(({ device, views }) => ({
    device,
    views,
    share: total === 0 ? 0 : views / total,
  }));
}
