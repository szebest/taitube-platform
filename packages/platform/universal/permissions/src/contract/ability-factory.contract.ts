import type { Subject } from '@casl/ability';
import type { AbilityFactory } from '../ability-factory';

export type Check = readonly [action: string, subject: Subject];

export interface AbilityProbe<C> {
  readonly context: C;
  readonly granted: readonly Check[];
  readonly denied: readonly Check[];
}

export function describeAbilityFactoryContract<C>(
  makeFactory: () => AbilityFactory<string, Subject, C>,
  probes: readonly AbilityProbe<C>[]
): void {
  describe('AbilityFactory contract', () => {
    const decisions = (
      factory: AbilityFactory<string, Subject, C>,
      { context, granted, denied }: AbilityProbe<C>
    ) => {
      const ability = factory(context);
      return {
        granted: granted.map((check) => ability.can(check[0], check[1])),
        denied: denied.map((check) => ability.can(check[0], check[1])),
      };
    };

    it.each(probes.map((probe, index) => ({ index, probe })))(
      'allows what probe $index grants and denies the rest, an action nobody ruled on included',
      ({ probe }) => {
        expect(decisions(makeFactory(), probe)).toEqual({
          granted: probe.granted.map(() => true),
          denied: probe.denied.map(() => false),
        });
      }
    );

    it('builds each ability from its own context, in any order and as often as asked', () => {
      const factory = makeFactory();
      const forward = probes.map((probe) => decisions(factory, probe));
      const backward = probes
        .toReversed()
        .map((probe) => decisions(factory, probe))
        .toReversed();

      expect(backward).toEqual(forward);
      const pairs = probes.map(({ context }) => [factory(context), factory(context)]);

      expect(pairs.filter(([first, second]) => first === second)).toEqual([]);
    });
  });
}
