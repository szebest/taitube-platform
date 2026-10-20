import { render } from '@testing-library/react';
import { UI_COPY_KEYS, type UiCopy, useUiCopy } from '@vp/ui';
import { AppWords } from '../app-words';

function copyFromCatalogue() {
  const seen: UiCopy[] = [];
  function Reader() {
    seen.push(useUiCopy());
    return null;
  }
  render(
    <AppWords>
      <Reader />
    </AppWords>
  );
  return seen[0];
}

describe('@vp/queries: AppWords', () => {
  it.each(UI_COPY_KEYS)('fills the %s word from the en catalogue', (key) => {
    expect(copyFromCatalogue()?.[key]).not.toBe('');
  });
});
