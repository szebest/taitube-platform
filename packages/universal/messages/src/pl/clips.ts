import { dt } from '../define';

export const clips = {
  clip: dt('Klip'),
  dialogTitle: dt('Utwórz klip z tego filmu'),
  dialogDescription: dt(
    'Wybierz fragment trwający od {min:number} do {max:number} sekund. Każdy, kto ma link, odtworzy tylko tę część.'
  ),
  rangeLabel: dt('Zakres klipu'),
  startThumb: dt('Początek klipu'),
  endThumb: dt('Koniec klipu'),
  rangeSummary: dt('Od {start} do {end}, długość: {length}'),
  titleLabel: dt('Tytuł'),
  titleInvalid: dt('Nadaj klipowi tytuł o długości od 1 do 100 znaków'),
  rangeInvalid: dt(
    'Klip trwa od {min:number} do {max:number} sekund i mieści się w granicach filmu'
  ),
  save: dt('Zapisz klip'),
  saved: dt('Klip zapisany, link skopiowany'),
  savedCopyFailed: dt('Klip zapisany, ale nie udało się skopiować linku'),
  saveFailed: dt('Nie udało się zapisać klipu'),
  fullVideo: dt('Obejrzyj cały film'),
  delete: dt('Usuń klip'),
  deleteTitle: dt('Usunąć ten klip?'),
  deleteDescription: dt('Jego link przestanie działać. Film pozostanie bez zmian.'),
  deleteConfirm: dt('Usuń'),
  deleted: dt('Klip usunięty'),
  deleteFailed: dt('Nie udało się usunąć klipu'),
  shelfTitle: dt('Klipy'),
  shelfEmpty: dt('Klipy, które utworzysz z filmów, pojawią się tutaj'),
} as const;
