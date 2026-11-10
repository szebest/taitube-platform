import { dt } from '../define';

export const studioBatch = {
  batchDeleted: dt('{count:plural}', {
    plural: { count: { one: '{?} video deleted', other: '{?} videos deleted' } },
  }),
  batchVisibilitySet: dt('{count:plural}', {
    plural: { count: { one: '{?} video updated', other: '{?} videos updated' } },
  }),
  batchPartial: dt(
    '{done:number} of {total:number} done, {failed:number} failed. The failed ones stay selected.'
  ),
  batchFailed: dt('Nothing was changed. Try again.'),
} as const;
