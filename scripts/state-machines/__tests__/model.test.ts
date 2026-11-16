import { defineMachine } from '../../../packages/universal/machine/src/index';
import { buildModel, type LoadedMachine } from '../model';

const loaded = (name: string, file: string): LoadedMachine => ({
  file,
  exportName: name.toUpperCase(),
  machine: defineMachine({
    name,
    states: ['a', 'b'],
    initial: ['a'],
    final: ['b'],
    events: { go: { from: ['a'], to: 'b', event: `${name}.went` }, skip: { from: ['a'], to: 'b' } },
  }),
});

describe('scripts: state-machines/model', () => {
  it('orders the machines by name whatever order they were found in', () => {
    const names = buildModel([loaded('zeta', 'z.machine.ts'), loaded('alpha', 'a.machine.ts')]).map(
      (model) => model.name
    );

    expect(names).toEqual(['alpha', 'zeta']);
  });

  it('describes a machine by its states, its edges with their labels and its diagram', () => {
    const [model] = buildModel([loaded('alpha', 'packages/x/a.machine.ts')]);

    expect(model).toMatchObject({
      name: 'alpha',
      file: 'packages/x/a.machine.ts',
      exportName: 'ALPHA',
      initial: ['a'],
      final: ['b'],
      states: ['a', 'b'],
      edges: [
        { event: 'go', from: ['a'], to: 'b', label: 'alpha.went' },
        { event: 'skip', from: ['a'], to: 'b', label: undefined },
      ],
    });
    expect(model?.mermaid.startsWith('stateDiagram-v2')).toBe(true);
  });
});
