import { defineMachine, isMachine } from '../define-machine';

const door = () =>
  defineMachine({
    name: 'door',
    states: ['open', 'closed', 'locked'],
    initial: ['closed'],
    final: [],
    events: {
      open: { from: ['closed'], to: 'open' },
      close: { from: ['open'], to: 'closed' },
      lock: { from: ['closed'], to: 'locked' },
      unlock: { from: ['locked'], to: 'closed' },
      slam: { from: ['open', 'closed'], to: 'closed', event: 'door.slammed' },
    },
  });

describe('@vp/machine: defineMachine', () => {
  it.each([
    { state: 'closed', event: 'open', next: 'open' },
    { state: 'open', event: 'open', next: undefined },
    { state: 'locked', event: 'open', next: undefined },
    { state: 'open', event: 'slam', next: 'closed' },
    { state: 'closed', event: 'slam', next: 'closed' },
    { state: 'locked', event: 'slam', next: undefined },
  ] as const)('next($state, $event) is $next', ({ state, event, next }) => {
    expect(door().next(state, event)).toBe(next);
  });

  it.each([
    { from: 'closed', to: 'open', expected: true },
    { from: 'closed', to: 'closed', expected: true },
    { from: 'open', to: 'locked', expected: false },
    { from: 'locked', to: 'open', expected: false },
  ] as const)('hasEdge($from, $to) is $expected', ({ from, to, expected }) => {
    expect(door().hasEdge(from, to)).toBe(expected);
  });

  it('reads the sources and the target of an event off the table', () => {
    expect(door().sources('slam')).toEqual(['open', 'closed']);
    expect(door().target('slam')).toBe('closed');
  });

  it('lists the events in table order', () => {
    expect(door().eventNames).toEqual(['open', 'close', 'lock', 'unlock', 'slam']);
  });

  it('keeps the optional event label on the edge', () => {
    expect(door().events.slam.event).toBe('door.slammed');
  });

  it('matrix covers every state and event pair once and agrees with next', () => {
    const machine = door();
    const cells = machine.matrix();
    expect(cells).toHaveLength(machine.states.length * machine.eventNames.length);
    expect(cells.every((cell) => cell.next === machine.next(cell.state, cell.event))).toBe(true);
  });
});

describe('@vp/machine: isMachine', () => {
  it.each([
    { value: door(), expected: true },
    { value: null, expected: false },
    { value: 'door', expected: false },
    { value: { eventNames: [] }, expected: false },
    { value: { next: () => undefined }, expected: false },
  ])('is $expected for $value', ({ value, expected }) => {
    expect(isMachine(value)).toBe(expected);
  });
});
