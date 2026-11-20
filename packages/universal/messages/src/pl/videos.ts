import { dt } from '../engine';

export const videos = {
  views: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} wyświetlenie',
        few: '{?} wyświetlenia',
        many: '{?} wyświetleń',
        other: '{?} wyświetlenia',
        formatter: { notation: 'compact' },
      },
    },
  }),
  visibility: dt('{visibility:enum}', {
    enum: { visibility: { public: 'Publiczny', unlisted: 'Niepubliczny', private: 'Prywatny' } },
  }),
} as const;
