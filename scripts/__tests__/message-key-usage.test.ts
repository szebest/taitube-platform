import { fixtureProgram } from '../../tests/architecture/program';
import { consumersByKey, messageKeyUsage } from '../message-key-usage';

const CATALOGUE = '/fx/catalogue.ts';
const CONSUMER = '/fx/consumer.tsx';

const CATALOGUE_SOURCE = `
export type MessageKey = 'a.event' | 'a.literal' | 'b.one' | 'b.two' | 'c.table' | 'c.prop';
export declare function t<K extends MessageKey>(key: K): string;
`;

function usageOf(consumer: string): Record<string, string[]> {
  const program = fixtureProgram({ [CATALOGUE]: CATALOGUE_SOURCE, [CONSUMER]: consumer });
  const usage = messageKeyUsage(program, [{ file: CATALOGUE, keyType: 'MessageKey' }], [CONSUMER]);
  return Object.fromEntries([...usage].map(([key, files]) => [key, [...files]]));
}

describe('scripts: message key usage', () => {
  it('counts a node where a key is expected, by its text or its type, and nothing else', () => {
    const usage = usageOf(`
      import { t, type MessageKey } from './catalogue';
      type SseEvent = 'a.event' | 'live.viewers';
      export const event: SseEvent = 'a.event';
      t('a.literal');
      declare const name: 'one' | 'two';
      t(\`b.\${name}\`);
      const TABLE = { pick: 'c.table' } as const;
      t(TABLE.pick);
      export function Head({ message }: { message: 'c.prop' }) { return t(message); }
      export const head = <Head message={'c.prop'} />;
      export function pass(key: MessageKey) { return t(key); }
    `);

    expect(usage).toEqual({
      'a.event': [],
      'a.literal': [CONSUMER],
      'b.one': [CONSUMER],
      'b.two': [CONSUMER],
      'c.table': [CONSUMER],
      'c.prop': [CONSUMER],
    });
  });

  it('names each key by the deepest workspace package its files sit in, sorted', () => {
    const usage = new Map([
      ['b.key', new Set(['apps/client/web/src/a.ts', 'packages/client/queries/src/b.ts'])],
      ['a.key', new Set<string>()],
    ]);
    const packages = [
      { name: '@vp/web', dir: 'apps/client/web' },
      { name: '@vp/queries', dir: 'packages/client/queries' },
    ];

    expect(consumersByKey(usage, packages)).toEqual({
      'a.key': [],
      'b.key': ['@vp/queries', '@vp/web'],
    });
  });
});
