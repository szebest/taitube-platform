import { dt } from '../define';

export const shorts = {
  title: dt('Shorts'),
  emptyTitle: dt('Shorts will appear here'),
  emptyDescription: dt(
    'Short vertical videos are on their way. Until then, the home feed has plenty to watch.'
  ),
  browse: dt('Browse videos'),
  announce: dt('{title}, by {channel}'),
} as const;
