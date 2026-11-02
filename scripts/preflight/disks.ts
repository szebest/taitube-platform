const GIB = 1024 ** 3;

/**
 * Free space a local stack run needs, measured on a 40 GiB colima disk holding 34 GiB of images: the
 * four app images and a smoke's volumes take about 5 GiB more, and the checkout's build and fixtures 10.
 */
export const THRESHOLDS = { hostFreeGib: 10, dockerFreeGib: 5 };

export interface Disk {
  label: string;
  freeBytes: number;
  minimumGib: number;
  fix: string;
}

/** The 1K-blocks `Available` column of the last line `df -k` prints. */
export function availableBytes(dfOutput: string): number {
  const last = dfOutput.trim().split('\n').at(-1) ?? '';
  const available = Number(last.trim().split(/\s+/)[3]);
  return Number.isFinite(available) ? available * 1024 : 0;
}

/** One line per disk below its threshold, with the numbers and what frees it; empty when all hold. */
export function shortfalls(disks: readonly Disk[]): string[] {
  return disks
    .filter(({ freeBytes, minimumGib }) => freeBytes < minimumGib * GIB)
    .map(
      ({ label, freeBytes, minimumGib, fix }) =>
        `${label}: ${(freeBytes / GIB).toFixed(1)} GiB free, below ${minimumGib} GiB. ${fix}`
    );
}
