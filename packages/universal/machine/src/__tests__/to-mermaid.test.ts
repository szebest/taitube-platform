import { defineMachine } from '../define-machine';
import { toMermaid } from '../to-mermaid';

describe('@vp/machine: toMermaid', () => {
  it('draws the initial arrows, one arrow per source of an event, and the final arrows', () => {
    const machine = defineMachine({
      name: 'm',
      states: ['a', 'b', 'c'],
      initial: ['a'],
      final: ['c'],
      events: {
        go: { from: ['a'], to: 'b' },
        finish: { from: ['a', 'b'], to: 'c' },
      },
    });
    expect(toMermaid(machine)).toBe(
      [
        'stateDiagram-v2',
        '  [*] --> a',
        '  a --> b: go',
        '  a --> c: finish',
        '  b --> c: finish',
        '  c --> [*]',
      ].join('\n')
    );
  });
});
