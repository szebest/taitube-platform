import { dt } from '@vp/shared-messages';

/** The app's own control words, read with `useT`; the kit's words stay in the shared `ui`. */
export const appUi = {
  legend: dt('Legenda'),
  selectAllRows: dt('Zaznacz wszystkie wiersze'),
  selectRow: dt('Zaznacz'),
  selectedCount: dt('Zaznaczono: {count}'),
  sortedAscending: dt('posortowano rosnąco'),
  sortedDescending: dt('posortowano malejąco'),
  notSorted: dt('nieposortowane'),
  rowsPerPage: dt('Wierszy na stronie'),
  pageOf: dt('Strona {position} z {count}'),
  previousPage: dt('Poprzednia strona'),
  nextPage: dt('Następna strona'),
  studioNavigation: dt('Studio'),
  inspectorEmpty: dt('Wybierz film, aby zobaczyć jego szczegóły'),
} as const;
