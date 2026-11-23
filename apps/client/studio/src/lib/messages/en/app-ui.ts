import { dt } from '@vp/shared-messages';

/** The app's own control words, read with `useT`; the kit's words stay in the shared `ui`. */
export const appUi = {
  legend: dt('Legend'),
  selectAllRows: dt('Select all rows'),
  selectRow: dt('Select'),
  selectedCount: dt('{count} selected'),
  sortedAscending: dt('sorted ascending'),
  sortedDescending: dt('sorted descending'),
  notSorted: dt('not sorted'),
  rowsPerPage: dt('Rows per page'),
  pageOf: dt('Page {position} of {count}'),
  previousPage: dt('Previous page'),
  nextPage: dt('Next page'),
  studioNavigation: dt('Studio'),
  inspectorEmpty: dt('Select a video to see its details'),
} as const;
