import { dt } from '../define';

export const studioChannel = {
  handleCooldownNotice: dt(
    'Nazwa użytkownika zmienia się raz na 30 dni. Stara przez 90 dni nadal otwiera Twój kanał, a nikt inny nie może jej w tym czasie przejąć.'
  ),
  handleCooldownUntil: dt('Nazwę użytkownika zmienisz ponownie {date}.'),
  countryLabel: dt('Kraj'),
  countryNone: dt('Nie pokazuj'),
  contactEmailLabel: dt('Adres e-mail do kontaktu'),
  contactEmailHint: dt(
    'Widzą go tylko zalogowani widzowie, którzy o niego poproszą. Nic na niego nie wysyłamy.'
  ),
  contactEmailInvalid: dt('Podaj poprawny adres e-mail.'),
  linksTitle: dt('Linki'),
  linksDescription: dt('Do 8 linków na karcie Informacje i jeden przycisk na banerze.'),
  linkPlatform: dt('Rozpoznano: {platform}'),
  moveLinkUp: dt('Przesuń link {position} w górę'),
  moveLinkDown: dt('Przesuń link {position} w dół'),
  bannerLinkTitle: dt('Przycisk na banerze'),
  bannerLinkLabel: dt('Etykieta przycisku'),
  bannerLinkUrl: dt('Adres przycisku'),
  bannerLinkHint: dt('Do 24 znaków i adres https. Przycisk jest wewnątrz banera, nigdy nad całym.'),
  bannerLinkInvalid: dt('Użyj etykiety do 24 znaków i adresu https.'),
  spotlightTitle: dt('Zwiastun i powitanie'),
  spotlightDescription: dt(
    'Film, który odwiedzający widzą na kanale jako pierwszy, i ten, który zamiast niego widzą subskrybenci. Tylko Twoje publiczne, gotowe filmy.'
  ),
  spotlightTrailer: dt('Zwiastun dla odwiedzających'),
  spotlightReturning: dt('Film dla subskrybentów'),
  spotlightChoose: dt('Wybierz film'),
  spotlightChange: dt('Zmień film'),
  spotlightClear: dt('Usuń'),
  spotlightSet: dt('Film jest ustawiony'),
  spotlightNone: dt('Nie ustawiono'),
  spotlightLanguages: dt('Języki'),
  spotlightDefault: dt('Domyślny'),
  spotlightLocaleDescription: dt('Opis po: {language}'),
  spotlightLocaleTrailer: dt('Zwiastun po: {language}'),
  spotlightLocaleHint: dt('Gdy puste, widzowie tego języka dostają wersję domyślną.'),
  spotlightInvalid: dt('Film musi być publiczny, gotowy i Twój.'),
};
