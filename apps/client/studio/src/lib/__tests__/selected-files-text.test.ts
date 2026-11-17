import { selectedFilesText } from '../selected-files-text';

describe('selectedFilesText', () => {
  it.each([
    { count: 1, text: 'Selected file:' },
    { count: 2, text: 'Selected files:' },
  ])('words $count chosen file(s) as $text', ({ count, text }) => {
    expect(selectedFilesText(count)).toBe(text);
  });
});
