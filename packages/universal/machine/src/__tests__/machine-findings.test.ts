import { type MachineSpec, defineMachine } from '../define-machine';
import { machineFindings } from '../machine-findings';

type Spec = MachineSpec<string, string>;

const build = (overrides: Partial<Spec> = {}) =>
  machineFindings(
    defineMachine<string, string>({
      name: 'm',
      states: ['a', 'b', 'c'],
      initial: ['a'],
      final: ['c'],
      events: {
        go: { from: ['a'], to: 'b' },
        finish: { from: ['b'], to: 'c' },
      },
      ...overrides,
    })
  );

const cases: { label: string; overrides: Partial<Spec>; finding: string }[] = [
  {
    label: 'an unreachable state',
    overrides: { states: ['a', 'b', 'c', 'd'], final: ['c', 'd'] },
    finding: 'm: state d is unreachable',
  },
  {
    label: 'a dead non-final state',
    overrides: { final: [] },
    finding: 'm: state c is not final and has no exit',
  },
  {
    label: 'a final state with an exit',
    overrides: {
      events: {
        go: { from: ['a'], to: 'b' },
        finish: { from: ['b'], to: 'c' },
        back: { from: ['c'], to: 'a' },
      },
    },
    finding: 'm: final state c has an outgoing edge',
  },
  {
    label: 'an event with no source',
    overrides: {
      events: {
        go: { from: ['a'], to: 'b' },
        finish: { from: ['b'], to: 'c' },
        idle: { from: [], to: 'a' },
      },
    },
    finding: 'm: event idle has no source state',
  },
  {
    label: 'an edge into an unknown state',
    overrides: {
      events: {
        go: { from: ['a'], to: 'b' },
        finish: { from: ['b'], to: 'c' },
        leap: { from: ['a'], to: 'z' },
      },
    },
    finding: 'm: event leap names unknown state z',
  },
  {
    label: 'an unknown initial state',
    overrides: { initial: ['a', 'q'] },
    finding: 'm: q is initial or final but not a state',
  },
  {
    label: 'a duplicated state',
    overrides: { states: ['a', 'b', 'c', 'a'] },
    finding: 'm: state a is listed twice',
  },
];

describe('@vp/machine: machineFindings', () => {
  it('is empty for a sound machine', () => {
    expect(build()).toEqual([]);
  });

  it.each(cases)('reports $label', ({ overrides, finding }) => {
    expect(build(overrides)).toContain(finding);
  });

  it('reaches a state through a self-loop and a cycle without looping forever', () => {
    expect(
      build({
        final: [],
        events: {
          go: { from: ['a'], to: 'b' },
          finish: { from: ['b'], to: 'c' },
          spin: { from: ['c', 'b'], to: 'c' },
          back: { from: ['c'], to: 'a' },
        },
      })
    ).toEqual([]);
  });
});
