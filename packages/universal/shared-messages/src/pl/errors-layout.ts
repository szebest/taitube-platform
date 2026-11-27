import { dt } from '../engine';

export const layoutErrors = {
  layoutLimitExceeded: dt(
    'Strona kanału może mieć do 10 kart (4 własne), 20 sekcji na karcie, 60 sekcji i 24 wybrane pozycje, łącznie do 128 KB.'
  ),
  layoutMarkdownInvalid: dt(
    'Tekst formatowany pozwala tylko na zwykły Markdown: bez HTML, skryptów i linków do obrazów.'
  ),
  layoutSlugInvalid: dt(
    'Adres własnej karty ma mieć od 3 do 30 liter, cyfr lub myślników, nie może być zajęty ani zastrzeżony.'
  ),
  layoutReferenceInvalid: dt(
    'Sekcja wskazuje na coś, czego nie ma, co jest prywatne lub nie pochodzi z tego kanału.'
  ),
  layoutStructureInvalid: dt(
    'Układ strony jest niespójny: sprawdź karty, ich kolejność i cele odnośników.'
  ),
  layoutScheduleInvalid: dt('Wybierz przyszły termin zaplanowanej zmiany strony.'),
  layoutScheduleNotFound: dt('Ta zaplanowana zmiana strony nie istnieje lub już się wykonała.'),
} as const;
