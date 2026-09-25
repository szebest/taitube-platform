import { render, renderHook } from '@testing-library/react';
import type { IntlBinding } from '@vp/intl';
import { dt } from '@vp/messages';
import type { ReactNode } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { Format } from '../format';
import { IntlProvider, type IntlProviderProps } from '../intl-provider';
import { useFormat } from '../use-format';
import { useT } from '../use-t';

const NOW = '2026-09-22T18:30:00.000Z';
const FIXED = { timeZone: 'UTC', now: NOW } as const;

function Probe({ seen }: { seen: IntlBinding[] }) {
  seen.push(useFormat());
  return null;
}

function Page() {
  const { tOr } = useT();
  return (
    <p>
      {tOr('videos.views', { count: 1_234_567 }, '')} ·{' '}
      <Format value={{ type: 'relative', value: '2026-09-19T18:30:00.000Z' }} />
    </p>
  );
}

describe('@vp/intl-react: IntlProvider', () => {
  it('builds its bindings once per locale, not once per render', () => {
    const seen: IntlBinding[] = [];
    const tree = (locale: string, render: number) => (
      <IntlProvider locale={locale} {...FIXED}>
        <Probe seen={seen} key={render} />
      </IntlProvider>
    );

    const { rerender } = render(tree('en', 1));
    rerender(tree('en', 2));
    rerender(tree('en', 3));
    rerender(tree('de', 4));

    expect(seen).toHaveLength(4);
    expect(new Set(seen.slice(0, 3)).size).toBe(1);
    expect(seen[3]).not.toBe(seen[0]);
    expect(seen[3]?.context.locale).toBe('de');
  });

  it('renders the same markup in the browser as a server string render given the same props', () => {
    const page = (
      <IntlProvider locale="en-GB" {...FIXED}>
        <Page />
      </IntlProvider>
    );

    const { container } = render(page);

    expect(container.innerHTML).toBe(renderToStaticMarkup(page));
    expect(container.textContent).toBe('1.2M views · 3 days ago');
  });

  it('hydrates a server render without a mismatch', () => {
    const page = (
      <IntlProvider locale="de" {...FIXED}>
        <Page />
      </IntlProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(page);
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(page, { container, hydrate: true });

    expect(reported).not.toHaveBeenCalled();
  });

  it('prefers the locale prop over what the browser says', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['sv-SE']);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntlProvider locale="de" {...FIXED}>
        {children}
      </IntlProvider>
    );

    expect(renderHook(useFormat, { wrapper }).result.current.context.locale).toBe('de');
  });

  it("falls back to the browser's languages without a prop", () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['sv-SE']);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntlProvider {...FIXED}>{children}</IntlProvider>
    );

    expect(renderHook(useFormat, { wrapper }).result.current.context.locale).toBe('sv-SE');
  });

  it('serves a translation passed beside en, falling back per key', () => {
    const catalogues: IntlProviderProps['catalogues'] = {
      sv: { errors: { forbidden: dt('Det får du inte göra.') } },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <IntlProvider locale="sv" catalogues={catalogues} {...FIXED}>
        {children}
      </IntlProvider>
    );
    const { t } = renderHook(useT, { wrapper }).result.current;

    expect(t('errors.forbidden')).toEqual({ ok: true, value: 'Det får du inte göra.' });
    expect(t('errors.internal')).toEqual({ ok: true, value: 'Something went wrong on our side.' });
  });
});
