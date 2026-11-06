import { dt } from '../define';

export const channels = {
  subscribers: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} subskrybent',
        few: '{?} subskrybentów',
        many: '{?} subskrybentów',
        other: '{?} subskrybenta',
        formatter: { notation: 'compact' },
      },
    },
  }),
  handle: dt('@{handle}'),
  subscribe: dt('Subskrybuj'),
  subscribed: dt('Subskrybujesz'),
  subscriptionsTitle: dt('Twoje subskrypcje'),
  subscriptionsEmpty: dt('Nie subskrybujesz jeszcze żadnego kanału'),
  subscriptionVideosTitle: dt('Filmy z subskrypcji'),
  yourVideos: dt('Twoje filmy'),
  viewChannel: dt('Zobacz kanał'),
} as const;
