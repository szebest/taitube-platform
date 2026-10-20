import { render } from '@testing-library/react';
import { IntlProvider } from '@vp/intl-react';
import { UI_COPY_KEYS, type UiCopy, useUiCopy } from '@vp/ui';
import { CatalogueUiCopy } from '../catalogue-ui-copy';

function copyFromCatalogue() {
  const seen: UiCopy[] = [];
  function Reader() {
    seen.push(useUiCopy());
    return null;
  }
  render(
    <IntlProvider locale="en" timeZone="UTC">
      <CatalogueUiCopy>
        <Reader />
      </CatalogueUiCopy>
    </IntlProvider>
  );
  return seen[0];
}

describe('@vp/queries: CatalogueUiCopy', () => {
  it.each(UI_COPY_KEYS)('fills the %s word from the en catalogue', (key) => {
    expect(copyFromCatalogue()?.[key]).not.toBe('');
  });
});
