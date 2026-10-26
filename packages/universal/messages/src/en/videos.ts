import { dt } from '../define';

export const videos = {
  moreLikeThis: dt('More like this'),
  watchedProgress: dt('{percent:number}% watched', {
    number: { percent: { maximumFractionDigits: 0 } },
  }),
  views: dt('{count:plural}', {
    plural: { count: { one: '{?} view', other: '{?} views', formatter: { notation: 'compact' } } },
  }),
  publishedRelative: dt('Published {when:date}', { date: { when: { style: 'medium' } } }),
  categories: dt('In {names:list}', { list: { names: { type: 'conjunction' } } }),
  rank: dt('{position:plural}', {
    plural: {
      position: { type: 'ordinal', one: '{?}st', two: '{?}nd', few: '{?}rd', other: '{?}th' },
    },
  }),
  resolution: dt('{height:number}p', { number: { height: { useGrouping: false } } }),
  visibility: dt('{visibility:enum}', {
    enum: { visibility: { public: 'Public', unlisted: 'Unlisted', private: 'Private' } },
  }),
} as const;
