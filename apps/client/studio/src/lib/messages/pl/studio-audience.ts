import { dt } from '@vp/shared-messages';

const VIEW_DEVICE = {
  desktop: 'Komputer',
  mobile: 'Telefon',
  tablet: 'Tablet',
  unknown: 'Nieokreślone',
} as const;

export const studioAudience = {
  deviceSplitTitle: dt('Wyświetlenia według urządzenia'),
  deviceName: dt('{device:enum}', { enum: { device: VIEW_DEVICE } }),
  deviceColumn: dt('Urządzenie'),
  deviceShareColumn: dt('Udział'),
  benchmarkTitle: dt('Pierwszy tydzień na tle wcześniejszych filmów'),
  benchmarkEmpty: dt('Za mało wcześniejszych filmów do porównania'),
  benchmarkViews: dt('Ten film'),
  benchmarkMedian: dt('Mediana wcześniejszych filmów'),
  benchmarkBand: dt('Środkowa połowa wcześniejszych filmów'),
  benchmarkDay: dt('Dzień {day:number}'),
  benchmarkColumnDay: dt('Dzień'),
  benchmarkColumnViews: dt('Ten film'),
  benchmarkColumnP25: dt('25. percentyl'),
  benchmarkColumnMedian: dt('Mediana'),
  benchmarkColumnP75: dt('75. percentyl'),
  dropOffsTitle: dt('Gdzie widzowie odchodzą'),
  dropOffBadge: dt('{time}, {share} odchodzi tutaj'),
} as const;
