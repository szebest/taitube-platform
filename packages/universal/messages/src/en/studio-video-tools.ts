import { dt } from '../define';

export const studioVideoTools = {
  editTabs: dt('Video sections'),
  editTabDetails: dt('Details'),
  editTabChapters: dt('Chapters'),
  editTabCorrections: dt('Corrections'),
  editTabHistory: dt('History'),
  chaptersTitle: dt('Chapters'),
  chaptersDescription: dt(
    'Chapters split the seek bar. At least three, the first at 0:00 and each at least 10 seconds after the one before.'
  ),
  chaptersTimeLabel: dt('Start of chapter {number}'),
  chaptersTitleLabel: dt('Title of chapter {number}'),
  chaptersAdd: dt('Add a chapter'),
  chaptersRemove: dt('Remove chapter {number}'),
  chaptersSuggest: dt('Suggest from transcript'),
  chaptersSuggestEmpty: dt('The transcript gave no suggestions.'),
  chaptersSuggestFailed: dt('The suggestions did not load.'),
  chaptersSuggested: dt('Suggestions filled in. Edit them, then save.'),
  chaptersSave: dt('Save chapters'),
  chaptersSaved: dt('Chapters saved'),
  chaptersSaveFailed: dt('The chapters were not saved.'),
  chaptersInvalid: dt('Check the chapters: {reason}'),
  chaptersBadTime: dt('Write each start as minutes and seconds, like 1:30.'),
  chaptersEmpty: dt('No chapters yet.'),
  correctionsTitle: dt('Corrections'),
  correctionsDescription: dt(
    'A correction shows as a card over the player while the video is inside its range, and is listed under the description. Up to 10, 2 to 30 seconds each.'
  ),
  correctionsStartLabel: dt('Starts at'),
  correctionsEndLabel: dt('Ends at'),
  correctionsTextLabel: dt('Correction'),
  correctionsAdd: dt('Add the correction'),
  correctionsAdded: dt('Correction added'),
  correctionsAddFailed: dt('The correction was not added.'),
  correctionsInvalid: dt(
    'Use a range of 2 to 30 seconds inside the video, and text of up to 200 characters.'
  ),
  correctionsRemove: dt('Remove the correction at {start}'),
  correctionsRemoved: dt('Correction removed'),
  correctionsRemoveFailed: dt('The correction was not removed.'),
  correctionsEmpty: dt('No corrections.'),
  correctionsLoadFailed: dt('The corrections did not load.'),
  correctionsListLabel: dt('Corrections of this video'),
  historyTitle: dt('History'),
  historyDescription: dt(
    'Every saved edit of the title, description, tags, category, visibility, chapters and comments switch. Restoring one writes a new version, nothing is deleted. The newest 50 are kept.'
  ),
  historyEmpty: dt('Nothing has been edited yet.'),
  historyLoadFailed: dt('The history did not load.'),
  historyListLabel: dt('Versions of this video'),
  historyVersion: dt('Version {version}'),
  historyCurrent: dt('Current'),
  historyOriginal: dt('Before the first edit'),
  historyNoChange: dt('No field differs from the version before it'),
  historyChanged: dt('{fields:list}', { list: { fields: { type: 'conjunction' } } }),
  historyField: dt('{field:enum}', {
    enum: {
      field: {
        title: 'title',
        description: 'description',
        tags: 'tags',
        categoryId: 'category',
        visibility: 'visibility',
        thumbnail: 'thumbnail',
        chapters: 'chapters',
        commentsEnabled: 'comments switch',
      },
    },
  }),
  historyRestoredFrom: dt('Restored from version {version}'),
  historyRestore: dt('Restore version {version}'),
  historyRestored: dt('Version restored'),
  historyRestoreFailed: dt('The version was not restored.'),
  historyRestoreHint: dt('Writes a new version with these values'),
} as const;
