import { dt } from '../engine';

export const linkErrors = {
  contentLinkNotFound: dt('Ten link nie istnieje lub został usunięty.'),
  linkPairNotAllowed: dt('Tego rodzaju linku nie można użyć między tymi elementami.'),
  linkRelationSameChannel: dt('Ten rodzaj linku działa tylko w obrębie jednego kanału.'),
  linkTargetBlocks: dt('Ten kanał nie przyjmuje linków z innych kanałów.'),
  linkTargetNotPublic: dt('Linkować można tylko publiczne, gotowe treści innego kanału.'),
  linkSelf: dt('Element nie może linkować do samego siebie.'),
  linkLoop: dt('Ten link zapętliłby serię.'),
  linkLimit: dt('Ten element lub kanał ma już maksymalną liczbę linków.'),
  linkAnchorInvalid: dt('Wybierz moment lub zakres wewnątrz filmu.'),
  linkExists: dt('Ten link już istnieje.'),
  linkSuggestionLimit: dt('Zaproponowano już maksymalną liczbę linków na dziś.'),
  endScreenInvalid: dt('Ten ekran końcowy nie pasuje do filmu. Sprawdź czas startu i elementy.'),
} as const;
