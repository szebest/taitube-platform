import { dt } from '../define';

export const studioBatch = {
  batchDeleted: dt('{count:plural}', {
    plural: { count: { one: '{?} video deleted', other: '{?} videos deleted' } },
  }),
  batchUpdated: dt('{count:plural}', {
    plural: { count: { one: '{?} video updated', other: '{?} videos updated' } },
  }),
  batchPartial: dt(
    '{done:number} of {total:number} done, {failed:number} failed. The failed ones stay selected.'
  ),
  batchFailed: dt('Nothing was changed. Try again.'),
  batchFailure: dt('{title} ({code}): {reason}'),
  batchFailureMore: dt('and {count:number} more'),
  batchBarLabel: dt('Actions for the selected videos'),
  batchAction: dt('{field:enum}', {
    enum: {
      field: {
        visibility: 'Visibility',
        categoryId: 'Category',
        addTags: 'Add tags',
        removeTags: 'Remove tags',
        commentsEnabled: 'Comments',
      },
    },
  }),
  batchFieldTitle: dt('{field:enum}', {
    enum: {
      field: {
        visibility: 'Change the visibility',
        categoryId: 'Change the category',
        addTags: 'Add tags',
        removeTags: 'Remove tags',
        commentsEnabled: 'Turn comments on or off',
      },
    },
  }),
  batchFieldLabel: dt('{field:enum}', {
    enum: {
      field: {
        visibility: 'Visibility',
        categoryId: 'Category',
        addTags: 'Tags to add',
        removeTags: 'Tags to remove',
        commentsEnabled: 'Comments',
      },
    },
  }),
  batchFieldAppliesTo: dt('{count:plural}', {
    plural: {
      count: {
        one: 'Applies to {?} selected video.',
        other: 'Applies to {?} selected videos.',
      },
    },
  }),
  batchTagsHint: dt('Separate tags with commas.'),
  batchApply: dt('Apply'),
  batchCommentsOption: dt('{state:enum}', {
    enum: { state: { on: 'Turned on', off: 'Turned off' } },
  }),
} as const;
