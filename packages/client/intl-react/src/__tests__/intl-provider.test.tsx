import { act, type RenderOptions, render, renderHook } from '@testing-library/react';
import type { IntlBinding } from '@vp/intl';
import { dt } from '@vp/messages';
import type { ReactElement, ReactNode } from 'react';
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

type ProviderProps = Omit<IntlProviderProps, 'children'>;

function withIntl(children: ReactNode, props: ProviderProps = FIXED) {
  return <IntlProvider {...props}>{children}</IntlProvider>;
}

function renderIntl(
  children: ReactNode,
  props: ProviderProps = FIXED,
  options: Pick<RenderOptions, 'container' | 'hydrate'> = {}
) {
  const tree: ReactElement = withIntl(children, props);
  const result = render(tree, options);
  const rerenderIntl = (next: ReactNode, nextProps: ProviderProps = props) =>
    result.rerender(withIntl(next, nextProps));
  return { ...result, tree, rerenderIntl };
}

function renderIntlHook<Result>(hook: () => Result, props: ProviderProps = FIXED) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => withIntl(children, props),
  });
}

describe('@vp/intl-react: IntlProvider', () => {
  it('builds its bindings once per locale, not once per render', () => {
    const seen: IntlBinding[] = [];
    const probe = (key: number) => <Probe seen={seen} key={key} />;

    const { rerenderIntl } = renderIntl(probe(1), { ...FIXED, locale: 'en' });
    rerenderIntl(probe(2));
    rerenderIntl(probe(3));
    rerenderIntl(probe(4), { ...FIXED, locale: 'de' });

    expect(seen).toHaveLength(4);
    expect(new Set(seen.slice(0, 3)).size).toBe(1);
    expect(seen[3]).not.toBe(seen[0]);
    expect(seen[3]?.context.locale).toBe('de');
  });

  it('renders the same markup in the browser as a server string render given the same props', () => {
    const { container, tree } = renderIntl(<Page />, { ...FIXED, locale: 'en-GB' });

    expect(container.innerHTML).toBe(renderToStaticMarkup(tree));
    expect(container.textContent).toMatch(/^1\.2[Mm] views · 3 days ago$/);
  });

  it('hydrates a server render without a mismatch', () => {
    const props = { ...FIXED, locale: 'de' };
    const container = document.createElement('div');
    container.innerHTML = renderToString(withIntl(<Page />, props));
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderIntl(<Page />, props, { container, hydrate: true });

    expect(reported).not.toHaveBeenCalled();
  });

  it('prefers the locale prop over what the browser says', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['sv-SE']);

    expect(
      renderIntlHook(useFormat, { ...FIXED, locale: 'de' }).result.current.context.locale
    ).toBe('de');
  });

  it("falls back to the browser's languages without a prop", () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['sv-SE']);

    expect(renderIntlHook(useFormat).result.current.context.locale).toBe('sv-SE');
  });

  it('serves a translation passed beside en, falling back per key', () => {
    const catalogues: IntlProviderProps['catalogues'] = {
      sv: { errors: { forbidden: dt('Det får du inte göra.') } },
    };
    const { t } = renderIntlHook(useT, { ...FIXED, locale: 'sv', catalogues }).result.current;

    expect(t('errors.forbidden')).toEqual({ ok: true, value: 'Det får du inte göra.' });
    expect(t('errors.internal')).toEqual({ ok: true, value: 'Something went wrong on our side.' });
  });

  it('keeps relative times current by ticking its clock when no now is pinned', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(NOW));
    const minuteBefore = new Date(Date.parse(NOW) - 60_000).toISOString();
    const seen: IntlBinding[] = [];

    const { container } = renderIntl(
      <>
        <Format value={{ type: 'relative', value: minuteBefore }} />
        <Probe seen={seen} />
      </>,
      { locale: 'en', timeZone: 'UTC' }
    );
    const before = container.textContent;
    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });

    expect([before, container.textContent]).toEqual(['1 minute ago', '3 minutes ago']);
    expect(new Set(seen.map(({ context }) => context.cache)).size).toBe(1);
    vi.useRealTimers();
  });
});
