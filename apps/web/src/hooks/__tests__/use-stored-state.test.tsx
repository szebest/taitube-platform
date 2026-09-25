import { renderToStaticMarkup } from 'react-dom/server';
import { z } from 'zod';
import { asLivePage } from '../../__tests__/live-page';
import { useStoredState } from '../use-stored-state';

vi.mock(import('react'), async (importOriginal) =>
  (await import('../../__tests__/live-page')).withLivePage(await importOriginal())
);

const Flag = z.boolean();

function stubStorage(entries: Record<string, string> = {}) {
  const stored = new Map(Object.entries(entries));
  const dispatched: string[] = [];
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
    dispatchEvent: (event: Event) => dispatched.push(event.type),
  });
  return { stored, dispatched };
}

function renderFlag(clientDefault?: () => boolean) {
  const controls: { set?: ReturnType<typeof useStoredState<boolean>>[1] } = {};
  function Probe() {
    const [flag, set] = useStoredState('FLAG', Flag, false, clientDefault);
    controls.set = set;
    return <span>{`flag=${flag}`}</span>;
  }
  return { markup: renderToStaticMarkup(<Probe />), controls };
}

describe('apps/web: useStoredState', () => {
  it('renders the server value on the server, whatever the browser stored', () => {
    stubStorage({ FLAG: 'true' });

    expect(renderFlag().markup).toBe('<span>flag=false</span>');
  });

  it.each<{ scenario: string; entries: Record<string, string>; expected: boolean }>([
    { scenario: 'a stored value', entries: { FLAG: 'true' }, expected: true },
    { scenario: 'nothing stored', entries: {}, expected: false },
    { scenario: 'a value that is not JSON', entries: { FLAG: '{nope' }, expected: false },
    { scenario: 'a value of the wrong shape', entries: { FLAG: '"yes"' }, expected: false },
  ])('shows the live page $scenario as $expected', ({ entries, expected }) => {
    stubStorage(entries);

    expect(asLivePage(() => renderFlag()).markup).toBe(`<span>flag=${expected}</span>`);
  });

  it('falls back to the browser default on the live page when nothing is stored', () => {
    stubStorage();

    expect(asLivePage(() => renderFlag(() => true)).markup).toBe('<span>flag=true</span>');
  });

  it('falls back when the storage partition refuses to be read', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
      },
    });

    expect(asLivePage(() => renderFlag()).markup).toBe('<span>flag=false</span>');
  });

  it('writes JSON and tells the subscribers in this tab', () => {
    const { stored, dispatched } = stubStorage();

    renderFlag().controls.set?.(true);

    expect(stored.get('FLAG')).toBe('true');
    expect(dispatched).toEqual(['storage']);
  });

  it('applies an update to the stored value, not the server value', () => {
    const { stored } = stubStorage({ FLAG: 'true' });

    renderFlag().controls.set?.((current) => !current);

    expect(stored.get('FLAG')).toBe('false');
  });
});
