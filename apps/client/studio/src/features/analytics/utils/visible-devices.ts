import type { VideoAudience } from '@vp/api-contracts';
import { VIEW_DEVICES, type ViewDevice } from '@vp/domain';

export type DeviceRow = VideoAudience['devices'][number];

const REPORTED_DEVICES = VIEW_DEVICES.filter(
  (device): device is Exclude<ViewDevice, 'unknown'> => device !== 'unknown'
);

/**
 * The three device classes a player reports, each present with zero when nobody used it, in the
 * order the response gave; the unreported ones only when they are part of the range, not all of it.
 */
export function visibleDevices(devices: readonly DeviceRow[]): DeviceRow[] {
  const reported = REPORTED_DEVICES.map(
    (device) => devices.find((row) => row.device === device) ?? { device, views: 0, share: 0 }
  );
  const unknown = devices.find((row) => row.device === 'unknown');
  const rows =
    unknown && unknown.share > 0 && unknown.share < 1 ? [...reported, unknown] : reported;

  return rows.sort((left, right) => right.views - left.views);
}
