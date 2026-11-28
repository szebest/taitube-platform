import { dt } from '../engine';

export const layoutErrors = {
  layoutLimitExceeded: dt(
    'A channel page can hold up to 10 tabs (4 custom), 20 sections a tab, 60 sections and 24 picked items, in 128 KB.'
  ),
  layoutMarkdownInvalid: dt(
    'Rich text allows plain Markdown only: no HTML, scripts or image links.'
  ),
  layoutSlugInvalid: dt(
    'A custom tab address needs 3 to 30 letters, digits or dashes, unused and not reserved.'
  ),
  layoutReferenceInvalid: dt(
    'A section points at something that is missing, private or not from this channel.'
  ),
  layoutStructureInvalid: dt(
    'The page layout is inconsistent: check the tabs, their order and where each link leads.'
  ),
  layoutScheduleInvalid: dt('Pick a time in the future for a scheduled page change.'),
  layoutScheduleNotFound: dt('This scheduled page change does not exist or already ran.'),
} as const;
