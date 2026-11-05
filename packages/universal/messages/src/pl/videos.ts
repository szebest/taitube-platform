import { dt } from '../define';

export const videos = {
  moreLikeThis: dt('Podobne filmy'),
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
  publishedRelative: dt('Opublikowano {when:date}', { date: { when: { style: 'medium' } } }),
  categories: dt('Kategorie: {names:list}', { list: { names: { type: 'conjunction' } } }),
  rank: dt('{position:plural}', {
    plural: {
      position: { type: 'ordinal', other: '{?}.' },
    },
  }),
  resolution: dt('{height:number}p', { number: { height: { useGrouping: false } } }),
  visibility: dt('{visibility:enum}', {
    enum: { visibility: { public: 'Publiczny', unlisted: 'Niepubliczny', private: 'Prywatny' } },
  }),
} as const;
