import { Profiler, type ReactNode } from 'react';

/**
 * Counts the commits of each `Counted` subtree. A spec wraps the part it measures in one, builds that
 * element once, and re-renders the parent with unchanged inputs: a memoized parent commits the part
 * once, at mount, and a parent that is not memoized commits it again on every render.
 */
export function createRenderCounter() {
  const commits = new Map<string, number>();

  function Counted({ id, children }: { id: string; children: ReactNode }) {
    return (
      <Profiler id={id} onRender={() => commits.set(id, (commits.get(id) ?? 0) + 1)}>
        {children}
      </Profiler>
    );
  }

  return { Counted, commitsOf: (id: string) => commits.get(id) ?? 0 };
}
