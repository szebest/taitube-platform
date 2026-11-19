import { type DeviceClass, type DeviceFacts, deviceClassOf } from '../device-class';

describe('web-telemetry: deviceClassOf', () => {
  it.each<[string, DeviceFacts, DeviceClass]>([
    ['a phone', { coarsePointer: true, screenShortSide: 390 }, 'mobile'],
    ['the widest phone class', { coarsePointer: true, screenShortSide: 599 }, 'mobile'],
    ['the narrowest tablet class', { coarsePointer: true, screenShortSide: 600 }, 'tablet'],
    ['a tablet', { coarsePointer: true, screenShortSide: 820 }, 'tablet'],
    ['a desktop', { coarsePointer: false, screenShortSide: 1080 }, 'desktop'],
    ['a small screen with a mouse', { coarsePointer: false, screenShortSide: 400 }, 'desktop'],
  ])('reads %s', (_name, facts, expected) => {
    expect(deviceClassOf(facts)).toBe(expected);
  });
});
