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
  queueNav: dt('Review queue'),
  queueTitle: dt('Review queue'),
  queueListLabel: dt('Held comments'),
  queueEmptyTitle: dt('Nothing to review'),
  queueEmptyDescription: dt('Comments held for review wait here.'),
  queueFailed: dt('The review queue did not load.'),
  queueHeldReason: dt('{reason:enum}', {
    enum: {
      reason: {
        review_all: 'Held for review',
        link: 'Contains a link',
        blocked_word: 'Matched a blocked word',
        unknown: 'Held',
      },
    },
  }),
  queueOnVideo: dt('On {title}'),
  queueInThread: dt('A reply in a thread'),
  queueWatch: dt('Open the video'),
  queueHistoryTitle: dt('Recent comments by this author'),
  queueHistoryEmpty: dt('No other comments on your channel.'),
  queueHistoryFailed: dt('Their other comments did not load.'),
  queueState: dt('{state:enum}', {
    enum: { state: { published: 'Published', held: 'Held', hidden: 'Hidden' } },
  }),
  queueActionsLabel: dt('Actions on the open comment'),
  queueSelection: dt('{count:plural}', {
    plural: {
      count: { one: 'Acting on {?} selected comment', other: 'Acting on {?} selected comments' },
    },
  }),
  queueSelect: dt('Select'),
  queueUnselect: dt('Unselect'),
  queuePrevious: dt('Previous'),
  queueNext: dt('Next'),
  queueDisclosure: dt('{disclosure:enum}', {
    enum: { disclosure: { silent: 'Silent', visible: 'Visible', default: 'Channel default' } },
  }),
  queueFlip: dt('Flip who is told'),
  queueHelp: dt('Shortcuts'),
  queueHelpTitle: dt('Keyboard shortcuts'),
  queueHelpDescription: dt('They work anywhere on the page except in a field.'),
  queueKey: dt('{key:enum}', {
    enum: {
      key: {
        j: 'Next comment',
        k: 'Previous comment',
        a: 'Approve',
        r: 'Remove, with a reason',
        h: 'Hide',
        b: 'Ban the author',
        v: 'Switch the next action between silent and visible',
        x: 'Select or unselect',
        '?': 'Show this list',
      },
    },
  }),
} as const;
