import { dt } from '../define';

export const studioScreening = {
  adminTabScreening: dt('Held and flagged'),
  screeningTitle: dt('Held and flagged'),
  screeningIntro: dt(
    'Uploads the automatic check held or flagged. A score is evidence for you to read, never a verdict.'
  ),
  screeningCaption: dt('Held and flagged videos, open cases first'),
  screeningFilter: dt('Show'),
  screeningFilterOption: dt('{state:enum}', {
    enum: { state: { open: 'Open', decided: 'Decided' } },
  }),
  screeningColVideo: dt('Video'),
  screeningColScore: dt('Score'),
  screeningColReasons: dt('Reasons'),
  screeningColMatch: dt('Matched video'),
  screeningColState: dt('State'),
  screeningColCreated: dt('Checked'),
  screeningColActions: dt('Actions'),
  screeningReasonName: dt('{reason:enum}', {
    enum: {
      reason: {
        DUPLICATE: 'Duplicate of another video',
        PARTIAL_MATCH: 'Partial match',
        KNOWN_REJECTED: 'Matches a rejected video',
        NSFW: 'Explicit content',
        BLANK: 'Blank or frozen video',
        METADATA_SPAM: 'Spam in the text',
        SCREEN_ERROR: 'The check failed',
      },
    },
  }),
  screeningStateName: dt('{state:enum}', {
    enum: {
      state: {
        held: 'Held',
        flagged: 'Flagged',
        appealed: 'Appealed',
        approved: 'Approved',
        rejected: 'Rejected',
        dismissed: 'Dismissed',
      },
    },
  }),
  screeningMatchNone: dt('No matching video'),
  screeningMatchLine: dt('{title} on {channel}'),
  screeningMatchGone: dt('A video that is gone'),
  screeningRange: dt('{from} to {to}'),
  screeningEvidence: dt('Evidence'),
  screeningEvidenceFor: dt('Evidence for {title}'),
  screeningEvidenceDescription: dt(
    'What the check found, one block for each reason. Open the frames and the matched video before you decide.'
  ),
  screeningLimitsTitle: dt('What the matcher cannot do'),
  screeningLimits: dt(
    'It matches the catalogue of this platform only, never other sites. It survives re-encoding, scaling, bitrate changes, trimming, small overlays and mirroring. Heavy cropping, speed changes and re-recording a screen are not caught.'
  ),
  screeningFindingScore: dt('Score {score}'),
  screeningMatchedVideo: dt('Matched video'),
  screeningSameChannel: dt('Same channel, so advisory only'),
  screeningMirrored: dt('Mirrored copy'),
  screeningCoverageVideo: dt('Video match {value}'),
  screeningCoverageAudio: dt('Audio match {value}'),
  screeningSourceRange: dt('In this video: {range}'),
  screeningMatchedRange: dt('In the matched video: {range}'),
  screeningFrames: dt('Flagged frames'),
  screeningFrameAt: dt('Frame at {time}, score {score}'),
  screeningFlaggedShare: dt('Sampled frames over the threshold: {share}'),
  screeningSignals: dt('Metadata hits'),
  screeningProfanity: dt('Matched words'),
  screeningAppealHeading: dt('Appeal from the creator'),
  screeningDecisionNote: dt('Reason given: {note}'),
  screeningApprove: dt('Approve'),
  screeningApproveFor: dt('Approve {title}'),
  screeningReject: dt('Reject'),
  screeningRejectFor: dt('Reject {title}'),
  screeningDismiss: dt('Dismiss flags'),
  screeningDismissFor: dt('Dismiss the flags on {title}'),
  screeningRejectTitle: dt('Reject {title}?'),
  screeningRejectDescription: dt(
    'The creator reads your reason and can appeal. A different moderator decides an appeal.'
  ),
  screeningRejectReason: dt('Reason'),
  screeningRejectReasonHint: dt('The creator reads this. Required, at most 500 characters.'),
  screeningEmptyTitle: dt('Nothing held or flagged'),
  screeningEmptyDescription: dt('Uploads the automatic check holds or flags appear here.'),
  screeningFailed: dt('The held and flagged videos did not load.'),
  screeningActionFailed: dt('The decision was not saved.'),
  screeningConflict: dt('The video changed while you were deciding. The list was refreshed.'),
  creatorScreeningHeldTitle: dt('This video is on hold'),
  creatorScreeningHeldBody: dt(
    'A reviewer has to look at it before it can be published. You get a notification with the decision.'
  ),
  creatorScreeningRejectedTitle: dt('A reviewer rejected this video'),
  creatorScreeningReason: dt('{reason:enum}', {
    enum: {
      reason: {
        DUPLICATE: 'It looks like a copy of a video that is already on Taitube.',
        NSFW: 'It looks like it contains explicit content.',
        BLANK: 'It looks blank or frozen.',
        METADATA_SPAM: 'Its title, description or tags look like spam.',
        SCREEN_ERROR: 'The automatic check could not finish.',
      },
    },
  }),
  creatorScreeningNote: dt('The reviewer wrote: {note}'),
  creatorScreeningAppealSent: dt('Your appeal: {message}'),
  creatorScreeningAppealWaiting: dt('A different reviewer will decide it.'),
  creatorScreeningAppealDecided: dt('Your appeal was decided.'),
  creatorScreeningAppealLabel: dt('Why is this a mistake?'),
  creatorScreeningAppealHint: dt('At most 1000 characters.'),
  creatorScreeningAppealSubmit: dt('Send appeal'),
  creatorScreeningAppealFailed: dt('The appeal was not sent.'),
  creatorScreeningFailed: dt('Why this video is on hold did not load.'),
} as const;
