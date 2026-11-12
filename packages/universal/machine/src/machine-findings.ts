import type { Machine } from './define-machine';

export function machineFindings<S extends string, E extends string>(
  machine: Machine<S, E>
): string[] {
  const { name, states, initial, final, events, eventNames } = machine;
  const known = new Set<string>(states);
  const findings: string[] = [];

  for (const state of states) {
    if (states.indexOf(state) !== states.lastIndexOf(state)) {
      findings.push(`${name}: state ${state} is listed twice`);
    }
  }
  for (const state of [...initial, ...final]) {
    if (!known.has(state)) findings.push(`${name}: ${state} is initial or final but not a state`);
  }

  const outgoing = new Map<string, Set<string>>(states.map((state) => [state, new Set()]));
  for (const event of eventNames) {
    const { from, to } = events[event];
    if (from.length === 0) findings.push(`${name}: event ${event} has no source state`);
    for (const state of [...from, to]) {
      if (!known.has(state)) findings.push(`${name}: event ${event} names unknown state ${state}`);
    }
    for (const state of from) outgoing.get(state)?.add(to);
  }

  const reached = new Set<string>(initial);
  const queue: string[] = [...initial];
  for (let state = queue.shift(); state !== undefined; state = queue.shift()) {
    for (const target of outgoing.get(state) ?? []) {
      if (!reached.has(target)) {
        reached.add(target);
        queue.push(target);
      }
    }
  }

  for (const state of states) {
    if (!reached.has(state)) findings.push(`${name}: state ${state} is unreachable`);
    const isFinal = final.includes(state);
    const exits = outgoing.get(state)?.size ?? 0;
    if (!isFinal && exits === 0)
      findings.push(`${name}: state ${state} is not final and has no exit`);
    if (isFinal && exits > 0) findings.push(`${name}: final state ${state} has an outgoing edge`);
  }

  return findings;
}
