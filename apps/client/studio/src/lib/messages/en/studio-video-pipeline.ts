import { dt } from '@vp/shared-messages';

const SHAPE = { rect: 'Rectangle', ellipse: 'Ellipse' } as const;

export const studioVideoPipeline = {
  editTabEditVideo: dt('Edit video'),
  editVideoTitle: dt('Edit video'),
  editVideoDescription: dt(
    'Replace the file, trim it or blur parts of it. The link, views, likes and comments stay, and the current version plays until the new one is ready.'
  ),
  editVideoLoadFailed: dt('The versions of this video did not load.'),
  editVideoRendering: dt(
    'A new version is being prepared. The current one keeps playing until it is ready.'
  ),
  editVideoFailed: dt('The last change could not be processed, so the video was left as it was.'),
  editVideoNeedsReview: dt(
    'The new file is a different length. Check the chapters, corrections and captions.'
  ),
  replaceTitle: dt('Replace the file'),
  replaceDescription: dt(
    'Upload a new file for this video. It keeps its link and its numbers, and the current file plays until the new one is ready.'
  ),
  replaceFileLabel: dt('New file'),
  replaceStart: dt('Replace'),
  replaceUploading: dt('Uploading the new file'),
  replaceStarted: dt('Upload finished. The new file is being processed.'),
  replaceFailed: dt('The file could not be replaced.'),
  trimTitle: dt('Trim and blur'),
  trimBaseNotice: dt(
    'Edits apply to the original version, which is kept for 14 days after your last edit so you can revert. After that they become permanent, and further edits apply to the edited video.'
  ),
  trimTimelineLabel: dt('Part of the video to keep'),
  trimStartLabel: dt('Keep from'),
  trimEndLabel: dt('Keep until'),
  trimSummary: dt('Keeps {start} to {end}'),
  blursTitle: dt('Blurred regions'),
  blursEmpty: dt('No blurred regions.'),
  blursListLabel: dt('Blurred regions of this video'),
  blurRow: dt('{shape:enum} from {start} to {end}', { enum: { shape: SHAPE } }),
  blurAdd: dt('Add a blurred region'),
  blurEdit: dt('Edit the region from {start}'),
  blurRemove: dt('Remove the region from {start}'),
  blurTimelineLabel: dt('When the region is blurred'),
  blurStartLabel: dt('Blur from'),
  blurEndLabel: dt('Blur until'),
  blurSummary: dt('Blurred from {start} to {end}'),
  blurShape: dt('Shape'),
  blurShapeOption: dt('{shape:enum}', { enum: { shape: SHAPE } }),
  blurLeft: dt('Left edge, % of the width'),
  blurTop: dt('Top edge, % of the height'),
  blurWidth: dt('Width, %'),
  blurHeight: dt('Height, %'),
  blurStrength: dt('Strength'),
  editsInvalid: dt(
    'Check the edits: the trim keeps at least a second, and each region stays inside the frame and the video.'
  ),
  editsSave: dt('Save and render'),
  editsSaved: dt('Edits saved. The edited version is being prepared.'),
  editsSaveFailed: dt('The edits could not be saved.'),
  editsRevert: dt('Revert to the original'),
  editsReverted: dt('The original version is back.'),
  editsRevertFailed: dt('The edits could not be reverted.'),
  clipSuggestionsTitle: dt('Clip suggestions'),
  clipSuggestionsDescription: dt(
    'Stretches where viewers stayed, read from how long people watched this version.'
  ),
  clipSuggestionsEmpty: dt('No suggestions yet. They appear once people have watched the video.'),
  clipSuggestionsLoadFailed: dt('The clip suggestions did not load.'),
  clipSuggestionsListLabel: dt('Clip suggestions for this video'),
  clipSuggestionRange: dt('{start} to {end}'),
  clipSuggestionLost: dt('{share} of viewers left during it'),
  clipSuggestionCreate: dt('Create a clip from {start}'),
  clipSuggestionTitle: dt('Clip from {start}'),
  clipCreated: dt('Clip created'),
  clipCreateFailed: dt('The clip could not be created.'),
};
