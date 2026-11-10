import { dt } from '../define';

export const studioComments = {
  commentsNav: dt('Comments'),
  commentsNavNew: dt('New comments'),
  commentsTitle: dt('Comments'),
  commentsFilter: dt('Show'),
  commentsFilterOption: dt('{filter:enum}', {
    enum: {
      filter: {
        all: 'All',
        unanswered: 'Unanswered',
        reported: 'Reported',
        held: 'Held',
        hidden: 'Hidden',
        questions: 'Questions',
        restricted: 'Restricted',
      },
    },
  }),
  commentsCaption: dt('Comments on your videos, newest first'),
  commentsVideo: dt('Video'),
  commentsAuthor: dt('Author'),
  commentsComment: dt('Comment'),
  commentsPosted: dt('Posted'),
  commentsActions: dt('Actions'),
  commentsReply: dt('Reply'),
  commentsReplyLabel: dt('Your reply'),
  commentsSendReply: dt('Post reply'),
  commentsReplied: dt('Reply posted'),
  commentsReplyFailed: dt('Your reply was not posted.'),
  commentsHeart: dt('Heart'),
  commentsHeartFailed: dt('The heart was not changed.'),
  commentsPin: dt('Pin'),
  commentsPinFailed: dt('The pin was not changed.'),
  commentsEmptyTitle: dt('No comments here'),
  commentsEmptyDescription: dt('Comments viewers leave on your videos appear here.'),
  commentsFailed: dt('The comments did not load.'),
} as const;
