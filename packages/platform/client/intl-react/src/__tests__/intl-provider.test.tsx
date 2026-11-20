import type { IntlBinding } from '@kit/intl';
import { act, type RenderOptions, render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { Format } from '../format';
import { useFormat } from '../use-format';
import { useT } from '../use-t';
import { SpecIntl, type SpecIntlProps } from './spec-intl';

const NOW = '2026-09-22T18:30:00.000Z';
const FIXED = { locale: 'en', timeZone: 'UTC', now: NOW } as const;

function Probe({ seen }: { seen: IntlBinding[] }) {
  seen.push(useFormat());
  return null;
}

function Page() {
  const { count } = useT();
  return (
    <p>
      {count(1_234_567)} views ·{' '}
      <Format value={{ type: 'relative', value: '2026-09-19T18:30:00.000Z' }} />
    </p>
  );
}

type ProviderProps = Omit<SpecIntlProps, 'children'>;

function withIntl(children: ReactNode, props: ProviderProps = FIXED) {
  return <SpecIntl {...props}>{children}</SpecIntl>;
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

describe('@kit/intl-react: IntlProvider', () => {
  it('builds its bindings once per locale, not once per render', () => {
    const seen: IntlBinding[] = [];
    const probe = (key: number) => <Probe seen={seen} key={key} />;

    const { rerenderIntl } = renderIntl(probe(1));
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

  it('hands the translator the binding it built for the locale', () => {
    const { result } = renderIntlHook(useT, { ...FIXED, locale: 'sv' });

    expect(result.current.locale).toBe('sv');
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
