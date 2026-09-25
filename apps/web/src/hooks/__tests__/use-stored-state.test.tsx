import { renderToStaticMarkup } from 'react-dom/server';
import { z } from 'zod';
import { readStoredState, useStoredState, writeStoredState } from '../use-stored-state';

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

describe('apps/web: useStoredState', () => {
  it.each<{ scenario: string; entries: Record<string, string>; expected: boolean }>([
    { scenario: 'a stored value', entries: { FLAG: 'true' }, expected: true },
    { scenario: 'nothing stored', entries: {}, expected: false },
    { scenario: 'a value that is not JSON', entries: { FLAG: '{nope' }, expected: false },
    { scenario: 'a value of the wrong shape', entries: { FLAG: '"yes"' }, expected: false },
  ])('reads $scenario as $expected', ({ entries, expected }) => {
    stubStorage(entries);

    expect(readStoredState('FLAG', Flag, () => false)).toBe(expected);
  });

  it('falls back when the storage partition refuses to be read', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
      },
    });

    expect(readStoredState('FLAG', Flag, () => false)).toBe(false);
  });

  it('writes JSON and tells the subscribers in this tab', () => {
    const { stored, dispatched } = stubStorage();

    writeStoredState('FLAG', true);

    expect(stored.get('FLAG')).toBe('true');
    expect(dispatched).toEqual(['storage']);
  });

  it('renders the server value on the server, whatever the browser stored', () => {
    stubStorage({ FLAG: 'true' });

    function Probe() {
      const [flag] = useStoredState('FLAG', Flag, false);
      return <span>{`flag=${flag}`}</span>;
    }

    expect(renderToStaticMarkup(<Probe />)).toBe('<span>flag=false</span>');
  });
});
