import {
  LinerNotesBody,
  LinerNotesChapter,
  LinerNotesChapters,
  LinerNotesMeta,
  LinerNotesRoot,
  LinerNotesTimecode,
} from './liner-notes';

export const LinerNotes = {
  Root: LinerNotesRoot,
  Meta: LinerNotesMeta,
  Body: LinerNotesBody,
  Timecode: LinerNotesTimecode,
  Chapters: LinerNotesChapters,
  Chapter: LinerNotesChapter,
};

export { LinerNotesSkeleton } from './liner-notes';

export { useLinerNotes } from './liner-notes.context';
export { linerNotesStyles } from './liner-notes.variants';
