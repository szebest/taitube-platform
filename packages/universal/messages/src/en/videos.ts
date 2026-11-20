import { dt } from '../engine';

export const videos = {
  views: dt('{count:plural}', {
    plural: { count: { one: '{?} view', other: '{?} views', formatter: { notation: 'compact' } } },
  }),
  visibility: dt('{visibility:enum}', {
    enum: { visibility: { public: 'Public', unlisted: 'Unlisted', private: 'Private' } },
  }),
} as const;
