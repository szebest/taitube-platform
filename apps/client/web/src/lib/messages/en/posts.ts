import { dt } from '@vp/shared-messages';

export const posts = {
  postTitle: dt('Post'),
  channelTab: dt('{tab:enum}', { enum: { tab: { home: 'Home', posts: 'Posts' } } }),
  subscriptionsTabsLabel: dt('Subscription feeds'),
  subscriptionsTab: dt('{tab:enum}', {
    enum: { tab: { videos: 'Videos', community: 'Community' } },
  }),
  communityTitle: dt('Community posts'),
  createPost: dt('Create post'),
  empty: dt('No posts yet'),
  communityEmpty: dt('Posts from the channels you subscribe to show up here'),
  postBy: dt('Post by {channel}'),
  pinned: dt('Pinned'),
  like: dt('Like'),
  unlike: dt('Unlike'),
  likeFailed: dt('Your like could not be saved'),
  likeCount: dt('{count:plural}', {
    plural: {
      count: { one: '{?} like', other: '{?} likes', formatter: { notation: 'compact' } },
    },
  }),
  replyCount: dt('{count:plural}', {
    plural: {
      count: { one: '{?} reply', other: '{?} replies', formatter: { notation: 'compact' } },
    },
  }),
  openPost: dt('Open post'),
  pollVotes: dt('{count:plural}', {
    plural: {
      count: { one: '{?} vote', other: '{?} votes', formatter: { notation: 'compact' } },
    },
  }),
  pollClosed: dt('Voting has closed'),
  pollClosesAt: dt('Closes {date}'),
  pollHidden: dt('Results show after you vote'),
  voteFailed: dt('Your vote could not be saved'),
  yourVote: dt('Your vote'),
  correctAnswer: dt('Correct answer'),
  quizOutcome: dt('{state:enum}', {
    enum: { state: { correct: 'You got it right', wrong: 'Not quite' } },
  }),
  optionShare: dt('{percent:number}%', { number: { percent: { maximumFractionDigits: 0 } } }),
  shareVideo: dt('Video'),
  sharePlaylist: dt('Playlist'),
  shareStartsAt: dt('Opens at {time}'),
  sharePlaylistItems: dt('{count:plural}', {
    plural: {
      count: { one: '{?} video', other: '{?} videos', formatter: { notation: 'compact' } },
    },
  }),
  shareUnavailable: dt('Unavailable'),
  repliesTitle: dt('Replies'),
  repliesOff: dt('Replies are turned off for this post'),
  repliesEmpty: dt('No replies yet'),
  repliesFailed: dt('The replies could not be loaded'),
  replyFailed: dt('Your reply could not be sent'),
} as const;
