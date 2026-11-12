import { defineMachine } from '../../../packages/universal/machine/src/index';
import { buildModel, type LoadedMachine } from '../model';
import { renderStateMachines } from '../render';

const loaded = (name: string): LoadedMachine => ({
  file: `packages/x/${name}.machine.ts`,
  exportName: name.toUpperCase(),
  machine: defineMachine({
    name,
    states: ['a', 'b'],
    initial: ['a'],
    final: [],
    events: { go: { from: ['a'], to: 'b', event: `${name}.went` }, back: { from: ['b'], to: 'a' } },
  }),
});

const render = (...names: string[]) => renderStateMachines(buildModel(names.map(loaded)));

describe('scripts: state-machines/render', () => {
  it('renders the same bytes for the same machines', () => {
    expect(render('alpha', 'beta')).toBe(render('alpha', 'beta'));
  });

  it('describes a machine: its place, its states, its edges with the label they record, its diagram', () => {
    const text = render('alpha');

    expect(text).toContain('### alpha\n\n`ALPHA`, defined in `packages/x/alpha.machine.ts`.');
    expect(text).toContain('Initial: `a`. Final: none.');
    expect(text).toContain('| `go` | `a` | `b` | `alpha.went` |');
    expect(text).toContain('| `back` | `b` | `a` | - |');
    expect(text).toContain('```mermaid\nstateDiagram-v2\n  [*] --> a');
  });

  it.each([
    '# State machines',
    '## Approach',
    '## Rules',
    '## Adding one',
    '## When not to',
    '## Backlog',
  ])('keeps the hand-written %s section', (heading) => {
    expect(render('alpha')).toContain(`${heading}\n`);
  });

  it('ends with the backlog and a single newline, after the last machine', () => {
    const text = render('alpha', 'beta');

    expect(text.indexOf('### beta')).toBeLessThan(text.indexOf('## Backlog'));
    expect(text.endsWith('.\n')).toBe(true);
  });
});
