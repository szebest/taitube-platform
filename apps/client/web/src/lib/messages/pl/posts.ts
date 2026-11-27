import { dt } from '@vp/shared-messages';

export const posts = {
  postTitle: dt('Post'),
  channelTab: dt('{tab:enum}', { enum: { tab: { home: 'Strona główna', posts: 'Posty' } } }),
  subscriptionsTabsLabel: dt('Kanały subskrypcji'),
  subscriptionsTab: dt('{tab:enum}', {
    enum: { tab: { videos: 'Filmy', community: 'Społeczność' } },
  }),
  communityTitle: dt('Posty społeczności'),
  createPost: dt('Utwórz post'),
  empty: dt('Nie ma jeszcze postów'),
  communityEmpty: dt('Tutaj pojawią się posty z subskrybowanych kanałów'),
  postBy: dt('Post kanału {channel}'),
  pinned: dt('Przypięty'),
  like: dt('Lubię to'),
  unlike: dt('Cofnij polubienie'),
  likeFailed: dt('Nie udało się zapisać polubienia'),
  likeCount: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} polubienie',
        few: '{?} polubienia',
        many: '{?} polubień',
        other: '{?} polubienia',
        formatter: { notation: 'compact' },
      },
    },
  }),
  replyCount: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} odpowiedź',
        few: '{?} odpowiedzi',
        many: '{?} odpowiedzi',
        other: '{?} odpowiedzi',
        formatter: { notation: 'compact' },
      },
    },
  }),
  openPost: dt('Otwórz post'),
  pollVotes: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} głos',
        few: '{?} głosy',
        many: '{?} głosów',
        other: '{?} głosu',
        formatter: { notation: 'compact' },
      },
    },
  }),
  pollClosed: dt('Głosowanie zakończone'),
  pollClosesAt: dt('Kończy się {date}'),
  pollHidden: dt('Wyniki pokażą się po oddaniu głosu'),
  voteFailed: dt('Nie udało się zapisać głosu'),
  yourVote: dt('Twój głos'),
  correctAnswer: dt('Poprawna odpowiedź'),
  quizOutcome: dt('{state:enum}', {
    enum: { state: { correct: 'Dobra odpowiedź', wrong: 'Niestety nie' } },
  }),
  optionShare: dt('{percent:number}%', { number: { percent: { maximumFractionDigits: 0 } } }),
  shareVideo: dt('Film'),
  sharePlaylist: dt('Playlista'),
  shareStartsAt: dt('Otwiera od {time}'),
  sharePlaylistItems: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} film',
        few: '{?} filmy',
        many: '{?} filmów',
        other: '{?} filmu',
        formatter: { notation: 'compact' },
      },
    },
  }),
  shareUnavailable: dt('Niedostępne'),
  repliesTitle: dt('Odpowiedzi'),
  repliesOff: dt('Odpowiedzi pod tym postem są wyłączone'),
  repliesEmpty: dt('Nie ma jeszcze odpowiedzi'),
  repliesFailed: dt('Nie udało się wczytać odpowiedzi'),
  replyFailed: dt('Nie udało się wysłać odpowiedzi'),
} as const;
