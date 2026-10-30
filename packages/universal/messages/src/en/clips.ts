import { dt } from '../define';

export const clips = {
  clip: dt('Clip'),
  dialogTitle: dt('Clip this video'),
  dialogDescription: dt(
    'Pick a stretch of {min:number} to {max:number} seconds. Anyone with the link plays just that part.'
  ),
  rangeLabel: dt('Clip range'),
  startThumb: dt('Clip start'),
  endThumb: dt('Clip end'),
  rangeSummary: dt('{start} to {end}, {length} long'),
  titleLabel: dt('Title'),
  titleInvalid: dt('Give the clip a title of 1 to 100 characters'),
  rangeInvalid: dt(
    'A clip runs from {min:number} to {max:number} seconds and stays inside the video'
  ),
  save: dt('Save clip'),
  saved: dt('Clip saved, link copied'),
  savedCopyFailed: dt('Clip saved, but the link could not be copied'),
  saveFailed: dt('Your clip could not be saved'),
  fullVideo: dt('Watch the full video'),
  delete: dt('Delete clip'),
  deleteTitle: dt('Delete this clip?'),
  deleteDescription: dt('Its link stops working. The video is not affected.'),
  deleteConfirm: dt('Delete'),
  deleted: dt('Clip deleted'),
  deleteFailed: dt('The clip could not be deleted'),
  shelfTitle: dt('Clips'),
  shelfEmpty: dt('Clips you make from a video show up here'),
} as const;
