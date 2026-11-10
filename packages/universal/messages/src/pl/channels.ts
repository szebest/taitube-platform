import { dt } from '../define';

export const channels = {
  subscribers: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} subskrybent',
        few: '{?} subskrybentów',
        many: '{?} subskrybentów',
        other: '{?} subskrybenta',
        formatter: { notation: 'compact' },
      },
    },
  }),
  handle: dt('@{handle}'),
  subscribe: dt('Subskrybuj'),
  subscribed: dt('Subskrybujesz'),
  subscriptionsTitle: dt('Twoje subskrypcje'),
  subscriptionsEmpty: dt('Nie subskrybujesz jeszcze żadnego kanału'),
  subscriptionVideosTitle: dt('Filmy z subskrypcji'),
  yourVideos: dt('Twoje filmy'),
  viewChannel: dt('Zobacz kanał'),
  spotlightTrailer: dt('Zwiastun kanału'),
  spotlightReturning: dt('Witaj ponownie'),
  spotlightWatch: dt('Oglądaj'),
  aboutTitle: dt('O kanale'),
  aboutLinks: dt('Linki'),
  aboutCountry: dt('Kraj'),
  aboutContact: dt('Kontakt'),
  showContact: dt('Pokaż e-mail kontaktowy'),
  contactSignIn: dt('Zaloguj się, aby zobaczyć e-mail kontaktowy'),
  contactFailed: dt('Nie udało się pokazać e-maila kontaktowego'),
} as const;
