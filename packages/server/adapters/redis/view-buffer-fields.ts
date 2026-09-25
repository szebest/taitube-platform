import type { ViewCount, ViewDate } from '@vp/domain';

export type ViewMeasure = 'views' | 'watch';

const SEPARATOR = '|';

/** One hash field per video, day and measure, so a single `HINCRBY` moves one number. */
export function viewBufferField(videoId: string, viewDate: ViewDate, measure: ViewMeasure): string {
  return [videoId, viewDate, measure].join(SEPARATOR);
}

function isMeasure(value: string | undefined): value is ViewMeasure {
  return value === 'views' || value === 'watch';
}

/** Folds a drained hash back into counts; a field this module did not write is skipped. */
export function countsFromBuffer(hash: Readonly<Record<string, string>>): ViewCount[] {
  const counts = new Map<
    string,
    { videoId: string; viewDate: ViewDate; views: number; watchSeconds: number }
  >();

  for (const [field, raw] of Object.entries(hash)) {
    const [videoId, viewDate, measure, ...rest] = field.split(SEPARATOR);
    const amount = Number.parseInt(raw, 10);
    if (!(videoId && viewDate && isMeasure(measure)) || rest.length > 0 || Number.isNaN(amount)) {
      continue;
    }

    const key = viewBufferField(videoId, viewDate, 'views');
    const count = counts.get(key) ?? { videoId, viewDate, views: 0, watchSeconds: 0 };
    if (measure === 'views') count.views += amount;
    else count.watchSeconds += amount;
    counts.set(key, count);
  }

  return [...counts.values()].filter((count) => count.views > 0);
}
