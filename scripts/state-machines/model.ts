import { type Machine, toMermaid } from '../../packages/universal/machine/src/index';

export interface LoadedMachine {
  file: string;
  exportName: string;
  machine: Machine<string, string>;
}

export interface EdgeRow {
  event: string;
  from: readonly string[];
  to: string;
  label: string | undefined;
}

export interface MachineModel {
  name: string;
  file: string;
  exportName: string;
  initial: readonly string[];
  final: readonly string[];
  states: readonly string[];
  edges: EdgeRow[];
  mermaid: string;
}

/** One entry per machine, ordered by name, so the same sources always give the same document. */
export function buildModel(loaded: readonly LoadedMachine[]): MachineModel[] {
  return loaded
    .map(({ file, exportName, machine }) => ({
      name: machine.name,
      file,
      exportName,
      initial: machine.initial,
      final: machine.final,
      states: machine.states,
      edges: Object.entries(machine.events).map(([event, { from, to, event: label }]) => ({
        event,
        from,
        to,
        label,
      })),
      mermaid: toMermaid(machine),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
