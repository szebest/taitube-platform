import { type DeviceRow, visibleDevices } from '../visible-devices';

const row = (device: DeviceRow['device'], views: number, share: number): DeviceRow => ({
  device,
  views,
  share,
});

describe('apps/client/studio: visibleDevices', () => {
  it.each<[string, DeviceRow[], DeviceRow[]]>([
    [
      'keeps the three devices with zero for the ones nobody used',
      [row('mobile', 3, 1)],
      [row('mobile', 3, 1), row('desktop', 0, 0), row('tablet', 0, 0)],
    ],
    [
      'lists an unreported share that is part of the range, most viewed first',
      [row('mobile', 6, 0.6), row('unknown', 3, 0.3), row('desktop', 1, 0.1)],
      [row('mobile', 6, 0.6), row('unknown', 3, 0.3), row('desktop', 1, 0.1), row('tablet', 0, 0)],
    ],
    [
      'leaves out an unreported share that is the whole range',
      [row('unknown', 5, 1)],
      [row('desktop', 0, 0), row('mobile', 0, 0), row('tablet', 0, 0)],
    ],
    [
      'leaves out an unreported row with no views',
      [row('desktop', 2, 1), row('unknown', 0, 0)],
      [row('desktop', 2, 1), row('mobile', 0, 0), row('tablet', 0, 0)],
    ],
    [
      'gives the three devices at zero for an empty range',
      [],
      [row('desktop', 0, 0), row('mobile', 0, 0), row('tablet', 0, 0)],
    ],
  ])('%s', (_name, devices, expected) => {
    expect(visibleDevices(devices)).toEqual(expected);
  });
});
