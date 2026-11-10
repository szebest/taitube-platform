import { dt } from '../define';

export const studioModeration = {
  moderationBulkLabel: dt('Moderate the selected comments'),
  moderationAction: dt('{action:enum}', {
    enum: {
      action: {
        approve: 'Approve',
        hide: 'Hide',
        remove: 'Remove',
        shadow_ban: 'Shadow ban',
        ban: 'Ban',
      },
    },
  }),
  moderationBulkDone: dt('{count:plural}', {
    plural: { count: { one: '{?} comment updated', other: '{?} comments updated' } },
  }),
  moderationBulkPartial: dt('{done:number} of {total:number} done, {failed:number} refused'),
  moderationBulkRefusal: dt('{id}: {reason}'),
  moderationBulkFailed: dt('Nothing was changed. Try again.'),
  moderationReasonTitle: dt('{action:enum}', {
    enum: {
      action: {
        hide: 'Hide with a reason',
        remove: 'Remove with a reason',
        ban: 'Ban with a reason',
      },
    },
  }),
  moderationReasonDescription: dt('{action:enum}', {
    enum: {
      action: {
        hide: 'The author sees that the comment is hidden and why.',
        remove: 'The author is told it was removed and why.',
        ban: 'The author cannot comment or react, and sees why.',
      },
    },
  }),
  moderationReasonLabel: dt('Reason'),
  moderationReasonOption: dt('{reason:enum}', {
    enum: {
      reason: {
        spam: 'Spam',
        harassment: 'Harassment',
        hate: 'Hate',
        misinformation: 'Misinformation',
        other: 'Something else',
        off_topic: 'Off topic',
      },
    },
  }),
  moderationNoteLabel: dt('Note to the author'),
  moderationDurationLabel: dt('Ban for'),
  moderationDurationOption: dt('{duration:enum}', {
    enum: {
      duration: {
        '1h': '1 hour',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days',
        forever: 'Until lifted',
      },
    },
  }),
} as const;
