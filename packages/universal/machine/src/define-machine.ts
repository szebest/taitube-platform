interface EdgeSpec<S extends string> {
  readonly from: readonly NoInfer<S>[];
  readonly to: NoInfer<S>;
  readonly event?: string;
}

export interface MachineSpec<S extends string, E extends string> {
  readonly name: string;
  readonly states: readonly S[];
  readonly initial: readonly NoInfer<S>[];
  readonly final: readonly NoInfer<S>[];
  readonly events: Readonly<Record<E, EdgeSpec<S>>>;
}

interface MatrixCell<S extends string, E extends string> {
  readonly state: S;
  readonly event: E;
  readonly next: S | undefined;
}

export interface Machine<S extends string, E extends string> extends MachineSpec<S, E> {
  readonly eventNames: readonly E[];
  next(state: S, event: E): S | undefined;
  sources(event: E): readonly S[];
  target(event: E): S;
  matrix(): readonly MatrixCell<S, E>[];
}

export function defineMachine<const S extends string, const E extends string>(
  spec: MachineSpec<S, E>
): Machine<S, E> {
  const eventNames = Object.keys(spec.events) as E[];
  const next = (state: S, event: E): S | undefined =>
    spec.events[event].from.includes(state) ? spec.events[event].to : undefined;

  return {
    ...spec,
    eventNames,
    next,
    sources: (event) => spec.events[event].from,
    target: (event) => spec.events[event].to,
    matrix: () =>
      spec.states.flatMap((state) =>
        eventNames.map((event) => ({ state, event, next: next(state, event) }))
      ),
  };
}
