import { dt } from '../define';

export const errorPage = {
  notFoundTitle: dt('Nie znaleziono strony'),
  forbiddenTitle: dt('Nie masz do tego dostępu'),
  unauthorisedTitle: dt('Zaloguj się, aby kontynuować'),
  rateLimitedTitle: dt('Zwolnij na chwilę'),
  serverTitle: dt('Coś poszło nie tak po naszej stronie'),
  genericTitle: dt('Podczas wczytywania strony wystąpił błąd'),
  home: dt('Przejdź do strony głównej'),
} as const;
