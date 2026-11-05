import { act, render } from '@testing-library/react';
import { Format, useT } from '@vp/intl-react';
import { LOCALE_DETAILS, type SupportedLocale } from '@vp/messages';
import { UI_COPY_KEYS, type UiCopy, useUiCopy } from '@vp/ui';
import type { ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { AppWords, type AppWordsProps } from '../app-words';

const RENDERED_AT = '2026-10-30T12:00:00.000Z';
const HYDRATED_AT = '2026-10-30T12:00:05.000Z';
const PUBLISHED = { type: 'relative', value: '2026-10-30T11:59:24.000Z' } as const;

function renderWords(children: ReactNode, props: Omit<AppWordsProps, 'children'> = {}) {
  return <AppWords {...props}>{children}</AppWords>;
}

async function activeLocale(locale: SupportedLocale) {
  return { locale, catalogues: { [locale]: await LOCALE_DETAILS[locale].load() } };
}

async function hydrateServerMarkup(page: ReactNode) {
  const container = document.createElement('div');
  container.innerHTML = renderToString(page);
  const served = container.innerHTML;
  const onRecoverableError = vi.fn();
  await act(async () => {
    hydrateRoot(container, page, { onRecoverableError });
  });
  return { served, container, onRecoverableError };
}

function copyFromCatalogue() {
  const seen: UiCopy[] = [];
  function Reader() {
    seen.push(useUiCopy());
    return null;
  }
  render(renderWords(<Reader />));
  return seen[0];
}

function LocalisedPage() {
  const { tOr } = useT();
  return (
    <main>
      <p>{tOr('videos.views', { count: 3 }, '')}</p>
      <p>{tOr('videos.views', { count: 5 }, '')}</p>
      <p>{tOr('settings.resultCount', { count: 22 }, '')}</p>
      <Format value={{ type: 'number', value: 1_234_567 }} />
      <Format value={PUBLISHED} />
    </main>
  );
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
    const page = renderWords(<Format value={PUBLISHED} />, { renderedAt: RENDERED_AT });
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

  it.each([
    { locale: 'en', words: /^3 views5 views22 settings1,234,56736 seconds ago$/ },
    {
      locale: 'pl',
      words: /^3 wyświetlenia5 wyświetleń22 ustawienia1\s234\s56736 sekund temu$/,
    },
  ] as const)(
    'hydrates the $locale server markup byte for byte, in its own words and separators',
    async ({ locale, words }) => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date(RENDERED_AT) });
      const page = renderWords(<LocalisedPage />, {
        renderedAt: RENDERED_AT,
        active: await activeLocale(locale),
      });

      const { served, container, onRecoverableError } = await hydrateServerMarkup(page);

      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe(served);
      expect(container.textContent).toMatch(words);
    }
  );
});
