import { dt } from '@vp/shared-messages';

const SORTS = {
  manual: 'Manual order',
  added: 'Recently added',
  duration: 'Shortest first',
  channel: 'Channel',
  unwatched_first: 'Unwatched first',
};

const REFUSALS = {
  FORBIDDEN: 'you may not move it',
  PLAYLIST_ITEM_NOT_FOUND: 'it left the playlist',
  VIDEO_NOT_FOUND: 'its video is gone',
  UNKNOWN: 'it was refused',
};

const LINE_STATUSES = {
  added: 'Added',
  duplicate: 'Already in the playlist',
  not_found: 'No such video',
  unrecognised: 'Not a video of this site',
};

export const playlistEdit = {
  addedBy: dt('Added by {name}'),
  segmentRange: dt('{start} to {end}'),
  segmentFrom: dt('From {start}'),
  sectionActions: dt('Actions for {title}'),
  renameSection: dt('Rename section'),
  removeSection: dt('Remove section'),
  editItem: dt('Edit note and segment'),
  selectItem: dt('Select {title}'),
  smartReadOnly: dt('This playlist fills itself from its rules, so its order cannot be changed.'),
  sortedReadOnly: dt('Sorted for viewing. Pick Manual order to drag videos.'),
  sortedLoadFailed: dt('The sorted videos could not be loaded'),
  toolbarLabel: dt('Playlist tools'),
  sortMenu: dt('Sort: {sort:enum}', { enum: { sort: SORTS } }),
  sort: dt('{sort:enum}', { enum: { sort: SORTS } }),
  saveOrder: dt('Save this order'),
  orderSaved: dt('The playlist keeps this order now'),
  addSection: dt('Add section'),
  select: dt('Select'),
  import: dt('Import'),
  export: dt('Export'),
  selectionLabel: dt('Selected videos'),
  selectedCount: dt('{count:number} selected'),
  moveTo: dt('Move to'),
  copyTo: dt('Copy to'),
  mergeInto: dt('Merge into'),
  sectionDialogTitle: dt('{mode:enum}', {
    enum: { mode: { add: 'Add a section', rename: 'Rename section' } },
  }),
  sectionDialogBody: dt(
    'A section names the videos under it. It holds no video and is not counted.'
  ),
  sectionTitleLabel: dt('Section title'),
  sectionTitleInvalid: dt('Use 1 to {max:number} characters'),
  save: dt('Save'),
  sectionSaved: dt('Section saved'),
  sectionRemoved: dt('Section removed'),
  itemDialogTitle: dt('Note and segment'),
  itemMissing: dt('This video is no longer in the playlist'),
  noteLabel: dt('Note'),
  noteCount: dt('{count:number} of {max:number}'),
  noteInvalid: dt('Keep the note to {max:number} characters'),
  segmentLabel: dt('Segment'),
  segmentWhole: dt('Plays the whole video'),
  startLabel: dt('Start'),
  endLabel: dt('End'),
  addSegment: dt('Play only part of it'),
  clearSegment: dt('Clear segment'),
  timeInvalid: dt('Write a time as m:ss'),
  segmentInvalid: dt('A segment lasts at least a second and stays inside the video'),
  itemSaved: dt('Note and segment saved'),
  transferTitle: dt('{mode:enum}', {
    enum: { mode: { move: 'Move to a playlist', copy: 'Copy to a playlist' } },
  }),
  transferBody: dt('{count:plural}', {
    plural: {
      count: {
        one: 'Pick where the selected video goes.',
        other: 'Pick where the {?} selected videos go.',
      },
    },
  }),
  nothingSelected: dt('Select the videos first, then pick where they go.'),
  targetsLabel: dt('Your playlists'),
  smartTarget: dt('Fills itself from rules'),
  targetsLoadFailed: dt('Your playlists could not be loaded'),
  transferAction: dt('{mode:enum}', { enum: { mode: { move: 'Move', copy: 'Copy' } } }),
  resultLanded: dt('{mode:enum}: {count:number}', {
    enum: { mode: { move: 'Moved', copy: 'Copied', merge: 'Merged' } },
  }),
  resultDuplicates: dt('Skipped as already there: {count:number}'),
  resultRefused: dt('Refused: {count:number}'),
  refusedItem: dt('{title}: {reason:enum}', { enum: { reason: REFUSALS } }),
  done: dt('Done'),
  mergeTitle: dt('Merge playlists'),
  mergeBody: dt(
    'Copies the videos of up to {max:number} playlists in order. Videos already there are skipped.'
  ),
  mergeSourcesLabel: dt('Playlists to merge'),
  mergeNoSources: dt('You have no other playlist to merge'),
  mergeTargetLabel: dt('Merge into'),
  mergeTarget: dt('{target:enum}', {
    enum: { target: { current: 'This playlist', new: 'A new playlist' } },
  }),
  newTitleLabel: dt('Title of the new playlist'),
  deleteSources: dt('Delete the merged playlists afterwards'),
  mergeAction: dt('Merge'),
  importTitle: dt('Import and export'),
  importTabs: dt('Import or export'),
  tab: dt('{tab:enum}', { enum: { tab: { import: 'Import', export: 'Export' } } }),
  importBody: dt(
    'Paste a JSON or CSV export, or one video link or id of this site per line. A link to another site is reported and never opened.'
  ),
  formatLabel: dt('Format'),
  format: dt('{format:enum}', {
    enum: { format: { json: 'JSON', csv: 'CSV', urls: 'Links or ids' } },
  }),
  contentLabel: dt('What to import'),
  chooseFile: dt('Or choose a file'),
  importEmpty: dt('Paste something to import first'),
  importTooLarge: dt('That is more than {max:number} bytes'),
  importTooManyLines: dt('That has {count:number} lines; at most {max:number} go in at once', {}),
  importAction: dt('Import'),
  importResultsLabel: dt('Import results'),
  importCount: dt('{status:enum}: {count:number}', {
    enum: { status: LINE_STATUSES },
  }),
  importLine: dt('Line {row:number}: {status:enum}', {
    enum: { status: LINE_STATUSES },
    number: { row: { useGrouping: false } },
  }),
  exportBody: dt('Download the videos you can watch here, with their notes and segments.'),
  exportAs: dt('{format:enum}', {
    enum: { format: { json: 'Download JSON', csv: 'Download CSV' } },
  }),
  exported: dt('Saved {name}'),
  followingTitle: dt('Following'),
  followingEmpty: dt('Playlists you follow show up here'),
  unavailable: dt('No longer available'),
  unfollow: dt('Unfollow'),
  unfollowed: dt('You no longer follow it'),
} as const;
