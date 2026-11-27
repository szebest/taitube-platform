export type KeyLayout = Readonly<Record<string, string | ((...args: never[]) => string)>>;

export type MakeKeyspace = () => KeyLayout;

const SEPARATOR = ':';

function keysOf(layout: KeyLayout, argument: string): string[] {
  return Object.values(layout).map((entry) =>
    typeof entry === 'string'
      ? entry
      : String(
          Reflect.apply(
            entry,
            undefined,
            Array.from({ length: entry.length }, () => argument)
          )
        )
  );
}

export function describeKeyspaceContract(makeKeyspace: MakeKeyspace): void {
  describe('Keyspace contract', () => {
    let layout: KeyLayout;

    beforeEach(() => {
      layout = makeKeyspace();
    });

    it('is frozen, so no caller adds or rewrites a key after the app defined them', () => {
      expect(Object.isFrozen(layout)).toBe(true);
    });

    it('holds every key under one namespace', () => {
      const namespaces = new Set(keysOf(layout, 'a').map((key) => key.split(SEPARATOR)[0]));

      expect(namespaces.size).toBe(1);
    });

    it('builds no two entries to the same key', () => {
      const keys = keysOf(layout, 'a');

      expect(new Set(keys).size).toBe(keys.length);
    });

    it('puts what a builder is given into its key, so two arguments never share one', () => {
      const [first, second] = [keysOf(layout, 'first'), keysOf(layout, 'second')];
      const parameterised = Object.values(layout).flatMap((entry, index) =>
        typeof entry === 'function' && entry.length > 0 ? [index] : []
      );

      expect(parameterised.filter((index) => first[index] === second[index])).toEqual([]);
    });

    it('has no entry the app did not define', () => {
      expect(Reflect.get(layout, 'contract.missing')).toBeUndefined();
    });
  });
}
