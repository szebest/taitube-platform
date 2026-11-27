import { createRegistry, provide } from '@kit/di';
import { attemptsFor, classifyError, errorCodeOf } from '../classify';
import {
  defineErrorCodes,
  ErrorCodeRegistry,
  type ErrorCodeSet,
  isRegisteredCode,
  retryClass,
} from '../registry';

/** @public */
export type MakeErrorCodeSet = () => ErrorCodeSet<string>;

const UNREGISTERED = 'CONTRACT_NOT_IN_THE_SET';

/** @public */
export function describeErrorCodeSetContract(makeSet: MakeErrorCodeSet): void {
  describe('ErrorCodeSet contract', () => {
    let set: ErrorCodeSet<string>;
    let codes: string[];

    beforeEach(() => {
      set = makeSet();
      codes = Object.keys(set.codes);
    });

    it('names every code after itself', () => {
      expect(Object.entries(set.codes).filter(([key, value]) => key !== value)).toEqual([]);
    });

    it('gives exactly the codes of the set a retry class, permanent or transient', () => {
      expect(Object.keys(set.retryClass).toSorted()).toEqual(codes.toSorted());
      expect(
        Object.values(set.retryClass).filter((cls) => cls !== 'permanent' && cls !== 'transient')
      ).toEqual([]);
    });

    it('persists a code of the set for an error that carries none', () => {
      expect(isRegisteredCode(set, set.internal)).toBe(true);
      expect(errorCodeOf(set, new Error('no code'))).toBe(set.internal);
    });

    it('is frozen, so no caller edits the vocabulary after the root built it', () => {
      expect([Object.isFrozen(set.codes), Object.isFrozen(set.retryClass)]).toEqual([true, true]);
    });

    it('treats a code outside the set as unregistered: transient to retry, unknown to classify', () => {
      expect(isRegisteredCode(set, UNREGISTERED)).toBe(false);
      expect(retryClass(set, UNREGISTERED)).toBe('transient');
      expect(classifyError(set, { code: UNREGISTERED })).toBe('unknown');
    });

    it('classifies each code of the set as declared, and gives a permanent one a single attempt', () => {
      const classified = codes.map((code) => [code, classifyError(set, { code })]);

      expect(classified).toEqual(codes.map((code) => [code, set.retryClass[code]]));
      expect(
        codes
          .filter((code) => set.retryClass[code] === 'permanent')
          .map((code) => attemptsFor(set, { code }, 5))
      ).not.toContain(5);
    });

    it('resolves the set an app provided, and a swapped one in its place', () => {
      const swapped = defineErrorCodes({
        codes: { CONTRACT_SWAPPED: 'CONTRACT_SWAPPED' },
        retryClass: { CONTRACT_SWAPPED: 'permanent' },
        internal: 'CONTRACT_SWAPPED',
      });
      const registry = createRegistry().provide(provide(ErrorCodeRegistry, set));

      expect(registry.get(ErrorCodeRegistry)).toEqual({ ok: true, value: set });
      expect(registry.provide(provide(ErrorCodeRegistry, swapped)).get(ErrorCodeRegistry)).toEqual({
        ok: true,
        value: swapped,
      });
    });
  });
}
