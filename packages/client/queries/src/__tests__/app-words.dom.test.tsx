import { act, render } from '@testing-library/react';
import { Format } from '@vp/intl-react';
import { UI_COPY_KEYS, type UiCopy, useUiCopy } from '@vp/ui';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { AppWords } from '../app-words';

const RENDERED_AT = '2026-10-30T12:00:00.000Z';
const HYDRATED_AT = '2026-10-30T12:00:05.000Z';
const PUBLISHED = { type: 'relative', value: '2026-10-30T11:59:24.000Z' } as const;

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(UI_COPY_KEYS)('fills the %s word from the en catalogue', (key) => {
    expect(copyFromCatalogue()?.[key]).not.toBe('');
  });

  it('hydrates the relative time the server wrote, then measures it from the clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(RENDERED_AT) });
    const page = (
      <AppWords renderedAt={RENDERED_AT}>
        <Format value={PUBLISHED} />
      </AppWords>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(page);
    const served = container.textContent;
    const onRecoverableError = vi.fn();

    vi.setSystemTime(new Date(HYDRATED_AT));
    await act(async () => {
      hydrateRoot(container, page, { onRecoverableError });
    });

    expect(served).toBe('36 seconds ago');
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe('41 seconds ago');
  });
});
