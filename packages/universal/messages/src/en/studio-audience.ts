import { dt } from '../define';

const VIEW_DEVICE = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  tablet: 'Tablet',
  unknown: 'Not reported',
} as const;

export const studioAudience = {
  deviceSplitTitle: dt('Views by device'),
  deviceName: dt('{device:enum}', { enum: { device: VIEW_DEVICE } }),
  deviceColumn: dt('Device'),
  deviceShareColumn: dt('Share'),
  benchmarkTitle: dt('First week against your earlier videos'),
  benchmarkEmpty: dt('Not enough earlier videos to compare'),
  benchmarkViews: dt('This video'),
  benchmarkMedian: dt('Median of earlier videos'),
  benchmarkBand: dt('Middle half of earlier videos'),
  benchmarkDay: dt('Day {day:number}'),
  benchmarkColumnDay: dt('Day'),
  benchmarkColumnViews: dt('This video'),
  benchmarkColumnP25: dt('25th percentile'),
  benchmarkColumnMedian: dt('Median'),
  benchmarkColumnP75: dt('75th percentile'),
  dropOffsTitle: dt('Where viewers leave'),
  dropOffBadge: dt('{time}, {share} leave here'),
} as const;
