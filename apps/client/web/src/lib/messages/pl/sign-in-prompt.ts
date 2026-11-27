import { dt } from '@vp/shared-messages';

export const signInPrompt = {
  body: dt('Twoje konto zachowuje polubienia, subskrypcje i playlisty na każdym urządzeniu.'),
  dismiss: dt('Nie teraz'),
  like: dt('Zaloguj się, aby polubić'),
  dislike: dt('Zaloguj się, aby nie polubić'),
  comment: dt('Zaloguj się, aby komentować'),
  reply: dt('Zaloguj się, aby odpowiedzieć'),
  heart: dt('Zaloguj się, aby dawać serduszka komentarzom'),
  subscribe: dt('Zaloguj się, aby subskrybować ten kanał'),
  save: dt('Zaloguj się, aby zapisać ten film'),
  playlist: dt('Zaloguj się, aby dodać to do playlisty'),
  queue: dt('Zaloguj się, aby ułożyć kolejkę'),
  clip: dt('Zaloguj się, aby stworzyć klip'),
  history: dt('Zaloguj się, aby zachować historię oglądania'),
  report: dt('Zaloguj się, aby to zgłosić'),
  bell: dt('Zaloguj się, aby dostawać powiadomienia'),
  feedback: dt('Zaloguj się, aby dostosować rekomendacje'),
  vote: dt('Zaloguj się, aby zagłosować'),
} as const;
