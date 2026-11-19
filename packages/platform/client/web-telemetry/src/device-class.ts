export type DeviceClass = 'desktop' | 'mobile' | 'tablet';

export interface DeviceFacts {
  readonly coarsePointer: boolean;
  readonly screenShortSide: number;
}

const MOBILE_MAX_SHORT_SIDE = 600;

export function deviceClassOf({ coarsePointer, screenShortSide }: DeviceFacts): DeviceClass {
  if (!coarsePointer) return 'desktop';
  return screenShortSide < MOBILE_MAX_SHORT_SIDE ? 'mobile' : 'tablet';
}
