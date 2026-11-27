import type { EnvRecord } from '../environment';
import type { EnvSource } from '../tokens';

export type MakeEnvSource = (held: EnvRecord) => EnvSource;

export function describeEnvSourceContract(makeEnvSource: MakeEnvSource): void {
  describe('EnvSource contract', () => {
    it.each([
      { key: 'API_URL', value: 'http://localhost:3000' },
      { key: 'EMPTY', value: '' },
    ])('returns $key exactly as it was held', ({ key, value }) => {
      const env = makeEnvSource({ [key]: value });

      expect(env.get(key)).toBe(value);
    });

    it.each([
      { shape: 'a key nobody held', key: 'MISSING' },
      { shape: 'a key held as undefined', key: 'UNSET' },
    ])('returns undefined for $shape', ({ key }) => {
      const env = makeEnvSource({ API_URL: 'http://localhost:3000', UNSET: undefined });

      expect(env.get(key)).toBeUndefined();
    });

    it('tells two keys apart', () => {
      const env = makeEnvSource({ A: '1', B: '2' });

      expect([env.get('A'), env.get('B')]).toEqual(['1', '2']);
    });
  });
}
