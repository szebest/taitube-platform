import {
  EXPERIMENT_VARIANT_IDS,
  type DeviceViewCount,
  type ExperimentCount,
  type ExperimentVariantId,
  type HourlyViewCount,
  type RetentionCount,
  type ShareLinkCount,
  VIEW_DEVICES,
  type ViewCount,
  type ViewDate,
  type ViewDevice,
  type ViewHour,
  mergeExperimentCounts,
  mergeShareLinkCounts,
} from '@vp/domain';

export type ViewMeasure = 'views' | 'watch';

const SEPARATOR = '|';

/** One hash field per video, day and measure, so a single `HINCRBY` moves one number. */
export function viewBufferField(videoId: string, viewDate: ViewDate, measure: ViewMeasure): string {
  return [videoId, viewDate, measure].join(SEPARATOR);
}

const DEVICE_PREFIX = 'device:';

/** Shares the views hash with `viewBufferField`, and `countsFromBuffer` skips it by its prefix. */
export function deviceViewField(videoId: string, viewDate: ViewDate, device: ViewDevice): string {
  return [videoId, viewDate, `${DEVICE_PREFIX}${device}`].join(SEPARATOR);
}

export type ShareLinkMeasure = 'views' | 'watch' | 'opens';
export type ExperimentFieldMeasure = 'impressions' | 'starts' | 'watch';

const LINK_PREFIX = 'link:';
const EXPERIMENT_PREFIX = 'exp:';

/** A fourth component on a views or watch field, which every other parser of the hash skips. */
export function shareLinkField(
  videoId: string,
  viewDate: ViewDate,
  measure: ShareLinkMeasure,
  linkId: string
): string {
  return [videoId, viewDate, measure, `${LINK_PREFIX}${linkId}`].join(SEPARATOR);
}

export function experimentField(
  videoId: string,
  viewDate: ViewDate,
  measure: ExperimentFieldMeasure,
  experimentId: string,
  variantId: ExperimentVariantId
): string {
  return [videoId, viewDate, measure, `${EXPERIMENT_PREFIX}${experimentId}:${variantId}`].join(
    SEPARATOR
  );
}

export function hourlyViewField(videoId: string, viewHour: ViewHour): string {
  return [videoId, viewHour].join(SEPARATOR);
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

  return [...counts.values()].filter((count) => count.views > 0 || count.watchSeconds > 0);
}

function isDevice(value: string): value is ViewDevice {
  return VIEW_DEVICES.some((device) => device === value);
}

/** Reads the device fields of a drained views hash; every other field kind is skipped. */
export function devicesFromBuffer(hash: Readonly<Record<string, string>>): DeviceViewCount[] {
  return Object.entries(hash).flatMap(([field, raw]) => {
    const [videoId, viewDate, kind, ...rest] = field.split(SEPARATOR);
    const views = Number.parseInt(raw, 10);
    const device = kind?.startsWith(DEVICE_PREFIX) ? kind.slice(DEVICE_PREFIX.length) : '';
    if (!(videoId && viewDate && isDevice(device)) || rest.length > 0) return [];
    return Number.isNaN(views) || views <= 0 ? [] : [{ videoId, viewDate, device, views }];
  });
}

/** Folds a drained retention hash back into counts; a field this module did not write is skipped. */
export function retentionFromBuffer(hash: Readonly<Record<string, string>>): RetentionCount[] {
  return Object.entries(hash).flatMap(([field, raw]) => {
    const [videoId, percent, ...rest] = field.split(SEPARATOR);
    const viewers = Number.parseInt(raw, 10);
    if (!videoId || rest.length > 0 || Number.isNaN(viewers) || viewers <= 0) return [];
    const step = Number.parseInt(percent ?? '', 10);
    return Number.isNaN(step) ? [] : [{ videoId, percent: step, viewers }];
  });
}

/** Folds a drained hourly hash back into counts; a field this module did not write is skipped. */
export function hourlyFromBuffer(hash: Readonly<Record<string, string>>): HourlyViewCount[] {
  return Object.entries(hash).flatMap(([field, raw]) => {
    const [videoId, viewHour, ...rest] = field.split(SEPARATOR);
    const views = Number.parseInt(raw, 10);
    if (!(videoId && viewHour) || rest.length > 0 || Number.isNaN(views) || views <= 0) return [];
    return [{ videoId, viewHour, views }];
  });
}

interface TaggedField {
  readonly viewDate: ViewDate;
  readonly measure: string;
  readonly tag: string;
  readonly amount: number;
}

function taggedFields(hash: Readonly<Record<string, string>>, prefix: string): TaggedField[] {
  return Object.entries(hash).flatMap(([field, raw]) => {
    const [videoId, viewDate, measure, tag, ...rest] = field.split(SEPARATOR);
    const amount = Number.parseInt(raw, 10);
    if (!(videoId && viewDate && measure && tag?.startsWith(prefix)) || rest.length > 0) return [];
    return Number.isNaN(amount) || amount <= 0
      ? []
      : [{ viewDate, measure, tag: tag.slice(prefix.length), amount }];
  });
}

function isVariantId(value: string | undefined): value is ExperimentVariantId {
  return EXPERIMENT_VARIANT_IDS.some((id) => id === value);
}

/** Reads the share link fields of a drained views hash, one count per link and day; every other kind is skipped. */
export function shareLinksFromBuffer(hash: Readonly<Record<string, string>>): ShareLinkCount[] {
  const counts = taggedFields(hash, LINK_PREFIX).flatMap(({ viewDate, measure, tag, amount }) => {
    const count = { linkId: tag, viewDate, opens: 0, views: 0, watchSeconds: 0 };
    if (measure === 'opens') return [{ ...count, opens: amount }];
    if (measure === 'views') return [{ ...count, views: amount }];
    return measure === 'watch' ? [{ ...count, watchSeconds: amount }] : [];
  });
  return mergeShareLinkCounts(counts);
}

/** Reads the test variant fields of a drained views hash, one count per variant and day; every other kind is skipped. */
export function experimentsFromBuffer(hash: Readonly<Record<string, string>>): ExperimentCount[] {
  const counts = taggedFields(hash, EXPERIMENT_PREFIX).flatMap(
    ({ viewDate, measure, tag, amount }) => {
      const [experimentId, variantId, ...rest] = tag.split(':');
      if (!(experimentId && isVariantId(variantId)) || rest.length > 0) return [];
      const count = {
        experimentId,
        variantId,
        viewDate,
        impressions: 0,
        starts: 0,
        watchSeconds: 0,
      };
      if (measure === 'impressions') return [{ ...count, impressions: amount }];
      if (measure === 'starts') return [{ ...count, starts: amount }];
      return measure === 'watch' ? [{ ...count, watchSeconds: amount }] : [];
    }
  );
  return mergeExperimentCounts(counts);
}
