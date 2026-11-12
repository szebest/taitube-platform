import type { Machine } from './define-machine';

export function toMermaid<S extends string, E extends string>(machine: Machine<S, E>): string {
  const lines = ['stateDiagram-v2'];
  for (const state of machine.initial) lines.push(`  [*] --> ${state}`);
  for (const event of machine.eventNames) {
    const { from, to } = machine.events[event];
    for (const state of from) lines.push(`  ${state} --> ${to}: ${event}`);
  }
  for (const state of machine.final) lines.push(`  ${state} --> [*]`);
  return lines.join('\n');
}
