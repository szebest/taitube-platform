import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/shared-messages: en ui', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'ui.close', expected: 'Close' },
    { key: 'ui.loading', expected: 'Loading' },
    { key: 'ui.required', expected: 'required' },
    { key: 'ui.noResults', expected: 'No results' },
    { key: 'ui.cancelled', expected: 'Cancelled' },
    { key: 'ui.appearance', expected: 'Appearance' },
    { key: 'ui.theme', expected: 'Theme' },
    { key: 'ui.mode', expected: 'Mode' },
    { key: 'ui.modeSystem', expected: 'System' },
    { key: 'ui.modeDark', expected: 'Dark' },
    { key: 'ui.modeLight', expected: 'Light' },
    { key: 'ui.modeOled', expected: 'OLED' },
    { key: 'ui.density', expected: 'Density' },
    { key: 'ui.densityComfortable', expected: 'Comfortable' },
    { key: 'ui.densityCompact', expected: 'Compact' },
    { key: 'ui.retry', expected: 'Try again' },
    { key: 'ui.breadcrumb', expected: 'Breadcrumb' },
    { key: 'ui.menu', expected: 'Menu' },
    { key: 'ui.skipToContent', expected: 'Skip to content' },
    { key: 'ui.account', expected: 'Account' },
    { key: 'ui.reference', expected: 'Reference' },
    { key: 'ui.copy', expected: 'Copy' },
    { key: 'ui.copied', expected: 'Copied' },
    { key: 'ui.technicalDetails', expected: 'Technical details' },
    { key: 'ui.moreActions', expected: 'More actions' },
    { key: 'ui.cancel', expected: 'Cancel' },
    { key: 'ui.addToQueue', expected: 'Add to queue' },
    { key: 'ui.playNext', expected: 'Play next' },
    { key: 'ui.live', expected: 'Live' },
    { key: 'ui.watched', expected: 'Watched' },
    { key: 'ui.save', expected: 'Save' },
    { key: 'ui.scrollBack', expected: 'Scroll back' },
    { key: 'ui.scrollForward', expected: 'Scroll forward' },
    { key: 'ui.description', expected: 'Description' },
    { key: 'ui.pinnedByCreator', expected: 'Pinned by creator' },
    { key: 'ui.delete', expected: 'Delete' },
    { key: 'ui.disclosureLabel', expected: 'Visibility to the author' },
    { key: 'ui.disclosureSilent', expected: 'Silent' },
    { key: 'ui.disclosureVisible', expected: 'Visible' },
    { key: 'ui.pickOfTheDay', expected: 'Pick of the day' },
    { key: 'ui.startHere', expected: 'Start here' },
    { key: 'ui.mostWatched', expected: 'Most watched' },
    { key: 'ui.mostViewed', expected: 'Most viewed' },
    { key: 'ui.noDataYet', expected: 'No data yet' },
    { key: 'ui.loadFailed', expected: 'Could not load this' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'ui.reorder', expected: 'Reorder Lisbon at night' },
    { key: 'ui.pickedUp', expected: 'Picked up Lisbon at night, position 3 of 12' },
    { key: 'ui.movedTo', expected: 'Moved to position 3' },
    { key: 'ui.droppedAt', expected: 'Dropped at position 3' },
    { key: 'ui.tagRemove', expected: 'Remove night' },
    { key: 'ui.tagDuplicate', expected: 'night is already in the list' },
  ] as const)('renders $key with the item and its place', ({ key, expected }) => {
    expect(t(key, { name: 'Lisbon at night', position: '3', count: '12', tag: 'night' })).toEqual({
      ok: true,
      value: expected,
    });
  });
});
