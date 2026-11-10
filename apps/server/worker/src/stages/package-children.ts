import { ChildResult, type ScreenResult, type ThumbnailResult } from '@vp/job-contracts';
import { assertNever } from '@vp/result';

interface MeasuredRendition {
  bytes?: number;
  durationMs?: number;
  avgBitrateBps?: number;
}

export interface PackageChildren {
  measured: Record<string, MeasuredRendition>;
  thumbnail: ThumbnailResult | undefined;
  screen: ScreenResult | undefined;
}

/** What a package job's flow children returned, told apart by the stage that wrote each value. */
export function readChildren(values: Record<string, unknown>): PackageChildren {
  const children: PackageChildren = { measured: {}, thumbnail: undefined, screen: undefined };

  for (const value of Object.values(values)) {
    const child = ChildResult.safeParse(value);
    if (!child.success) continue;

    switch (child.data.type) {
      case 'transcode': {
        const { rendition, bytes, durationMs, avgBitrateBps } = child.data;
        children.measured[rendition] = { bytes, durationMs, avgBitrateBps };
        break;
      }
      case 'thumbnail':
        children.thumbnail = child.data;
        break;
      case 'screen':
        children.screen = child.data;
        break;
      default:
        return assertNever(child.data, 'package child result');
    }
  }
  return children;
}
