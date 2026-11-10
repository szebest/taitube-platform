import { dt } from '../define';

export const studioCommentSettings = {
  settingsTitle: dt('Comment settings'),
  settingsLink: dt('Comment settings'),
  settingsForbidden: dt('Only the owner and managers change these settings.'),
  settingsReviewTitle: dt('Review'),
  settingsReviewDescription: dt('Hold comments for review before anyone else sees them.'),
  settingsReviewLabel: dt('Hold for review'),
  settingsReviewOption: dt('{mode:enum}', {
    enum: { mode: { none: 'Nothing', links: 'Links', all: 'Everything' } },
  }),
  settingsBlockedTitle: dt('Blocked words'),
  settingsBlockedDescription: dt(
    'A comment with one of these words is held, whatever the case or accents.'
  ),
  settingsBlockedLabel: dt('Blocked words'),
  settingsBlockedPlaceholder: dt('Add a word and press Enter'),
  settingsAllowlistTitle: dt('Allowed links'),
  settingsAllowlistDescription: dt('Links to these sites and their subdomains are not held.'),
  settingsAllowlistLabel: dt('Allowed sites'),
  settingsAllowlistPlaceholder: dt('example.com'),
  settingsSlowTitle: dt('Slow mode'),
  settingsSlowDescription: dt('How long a viewer waits between comments. Replies count.'),
  settingsSlowLabel: dt('Wait between comments'),
  settingsSlowOption: dt('{seconds:enum}', {
    enum: {
      seconds: {
        off: 'Off',
        '5': '5 seconds',
        '10': '10 seconds',
        '30': '30 seconds',
        '60': '1 minute',
        '300': '5 minutes',
      },
    },
  }),
  settingsSubscribersTitle: dt('Subscribers only'),
  settingsSubscribersDescription: dt('Only people subscribed to your channel can comment.'),
  settingsSubscribersLabel: dt('Only subscribers can comment'),
  settingsAgeTitle: dt('Account age'),
  settingsAgeDescription: dt('A new account waits this long before it can comment.'),
  settingsAgeLabel: dt('Minimum account age'),
  settingsAgeOption: dt('{days:enum}', {
    enum: {
      days: {
        '0': 'No minimum',
        '1': '1 day',
        '3': '3 days',
        '7': '7 days',
        '14': '14 days',
        '30': '30 days',
      },
    },
  }),
  settingsDefaultsTitle: dt('What authors are told'),
  settingsDefaultsDescription: dt(
    'For each action, choose whether the author sees what happened. A moderator can change it for one comment.'
  ),
  settingsDefaultRule: dt('{rule:enum}', {
    enum: {
      rule: {
        hide: 'Hide',
        remove: 'Remove',
        manual_hold: 'Hold by a moderator',
        'auto.blocked_words': 'Held for a blocked word',
        'auto.links': 'Held for a link',
        'auto.review_all': 'Held in review mode',
      },
    },
  }),
  settingsDefaultSeen: dt('{seen:enum}', {
    enum: {
      seen: {
        hold_silent: 'The author sees the comment as published.',
        hold_visible: 'The author sees that it waits for review.',
        hide_silent: 'The author sees the comment as normal.',
        hide_visible: 'The author sees it hidden, with the reason.',
        remove_silent: 'The author is not told.',
        remove_visible: 'The author gets the reason and a notification.',
      },
    },
  }),
  settingsTrustedTitle: dt('Trusted commenters'),
  settingsTrustedDescription: dt(
    'They skip automatic holds, slow mode and the account age check. Trust someone from the inbox.'
  ),
  settingsTrustedEmpty: dt('Nobody is trusted yet.'),
  settingsRemove: dt('Remove'),
  settingsTrustedRemove: dt('Stop trusting {name}'),
  settingsTrustedFailed: dt('The trusted commenters did not load.'),
  settingsRestrictionsTitle: dt('Restrictions'),
  settingsRestrictionsDescription: dt('Bans and shadow bans on your channel.'),
  settingsRestrictionsEmpty: dt('Nobody is restricted.'),
  settingsRestrictionsFailed: dt('The restrictions did not load.'),
  settingsRestrictionKind: dt('{kind:enum}', {
    enum: { kind: { shadow: 'Shadow ban', ban: 'Ban' } },
  }),
  settingsRestrictionUntil: dt('Until {date}'),
  settingsRestrictionForever: dt('Until lifted'),
  settingsRestrictionLift: dt('Lift'),
  settingsRestrictionLiftLabel: dt('Lift the restriction on {name}'),
  settingsRestrictionLifted: dt('The restriction is lifted'),
  settingsRestrictionLiftFailed: dt('The restriction was not lifted.'),
  settingsTrustAuthor: dt('Trust author'),
  settingsTrustAuthorDone: dt('The author is trusted'),
  settingsTrustAuthorFailed: dt('The author was not trusted.'),
  settingsRepliesTitle: dt('Saved replies'),
  settingsRepliesDescription: dt('Answers you reuse in the inbox, up to 20.'),
  settingsRepliesEmpty: dt('No saved replies yet.'),
  settingsRepliesFailed: dt('The saved replies did not load.'),
  settingsReplyTitleLabel: dt('Title'),
  settingsReplyBodyLabel: dt('Reply'),
  settingsReplyAdd: dt('Add a reply'),
  settingsReplySave: dt('Save reply'),
  settingsReplyEdit: dt('Edit {title}'),
  settingsReplyDelete: dt('Delete {title}'),
  settingsReplyFailed: dt('The reply was not saved.'),
  settingsReplyLimit: dt('You have 20 saved replies. Delete one to add another.'),
  repliesPick: dt('Saved replies'),
  repliesPickLabel: dt('Insert a saved reply'),
  repliesPickEmpty: dt('No saved replies yet.'),
} as const;
