import { dt } from '../define';

export const channels = {
  subscribers: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} subscriber',
        other: '{?} subscribers',
        formatter: { notation: 'compact' },
      },
    },
  }),
  handle: dt('@{handle}'),
} as const;
