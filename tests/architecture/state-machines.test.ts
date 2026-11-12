import { machineFindings } from '@vp/machine';
import ts from 'typescript';
import { loadMachines, renderFor } from '../../scripts/state-machines/run';
import { parseSource } from './parsed-sources';
import { productionSources, read, ROOT } from './repo-files';
import { STATE_LITERAL_COMPARES } from './state-literal-compares';
import { countStateLiteralCompares } from './state-literal-count';

const RULE_START = '**Lifecycles are tables.**';
const CHECKLIST_LINE = 'New status, phase or mode? It is a `*.machine.ts` table';

function misplacedDefinitions(file: string, source: string): string[] {
  if (file.endsWith('.machine.ts')) return [];
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineMachine'
    ) {
      found.push(`${file}: defineMachine(...) belongs in a *.machine.ts file`);
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(file, source));
  return found;
}

type Counts = Readonly<Record<string, number>>;

function ratchetFindings(actual: Counts, baseline: Counts): string[] {
  const findings: string[] = [];
  for (const file of new Set([...Object.keys(actual), ...Object.keys(baseline)])) {
    const now = actual[file] ?? 0;
    const allowed = baseline[file] ?? 0;
    if (now > allowed) {
      findings.push(
        `${file}: ${now} literal status comparisons, the baseline allows ${allowed}: read a defineMachine table instead (docs/state-machines.md)`
      );
    }
    if (now < allowed) {
      findings.push(
        `${file}: ${now} literal status comparisons, the baseline still says ${allowed}: lower it in tests/architecture/state-literal-compares.ts`
      );
    }
  }
  return findings;
}

describe('architecture: state machines', () => {
  it.each([
    {
      shape: 'a definition outside a machine file',
      file: 'packages/x/rule.ts',
      source: "const M = defineMachine({ name: 'm' });",
      found: 1,
    },
    {
      shape: 'a definition in a machine file',
      file: 'packages/x/rule.machine.ts',
      source: "export const M = defineMachine({ name: 'm' });",
      found: 0,
    },
    {
      shape: 'a mention of the name',
      file: 'packages/x/rule.ts',
      source: 'defineMachine;',
      found: 0,
    },
  ])('recognises $shape', ({ file, source, found }) => {
    expect(misplacedDefinitions(file, source)).toHaveLength(found);
  });

  it('defines a machine only in a *.machine.ts file', () => {
    expect(productionSources().flatMap((file) => misplacedDefinitions(file, read(file)))).toEqual(
      []
    );
  });

  it('keeps docs/state-machines.md equal to what pnpm gen:state-machines writes', async () => {
    expect(
      await renderFor(ROOT),
      'docs/state-machines.md is stale: run pnpm gen:state-machines'
    ).toBe(read('docs/state-machines.md'));
  });

  it('gives every machine a table without unreachable, dead or unused parts', async () => {
    const machines = await loadMachines(ROOT);

    expect(machines.length).toBeGreaterThanOrEqual(4);
    expect(machines.flatMap(({ machine }) => machineFindings(machine))).toEqual([]);
  });

  it.each([
    {
      shape: 'a literal status comparison',
      source: "if (video.status === 'READY') go();",
      count: 1,
    },
    { shape: 'a negated phase comparison', source: "return room.phase !== 'lobby';", count: 1 },
    { shape: 'a literal on the left', source: "return 'held' == comment.state;", count: 1 },
    {
      shape: 'a switch and a comparison',
      source: "switch (job.status) { default: } if (job.state === 'x') go();",
      count: 2,
    },
    { shape: 'a comparison with a variable', source: 'return video.status === wanted;', count: 0 },
    { shape: 'another property', source: "return video.kind === 'READY';", count: 0 },
  ])('counts $count for $shape', ({ source, count }) => {
    expect(countStateLiteralCompares('fixture.ts', source)).toBe(count);
  });

  it('counts nothing in a machine file', () => {
    expect(countStateLiteralCompares('a.machine.ts', "x.status === 'READY'")).toBe(0);
  });

  it.each<{ shape: string; actual: Counts; baseline: Counts; found: string }>([
    {
      shape: 'a file that grew',
      actual: { 'a.ts': 3 },
      baseline: { 'a.ts': 2 },
      found: 'allows 2',
    },
    { shape: 'a new file', actual: { 'b.ts': 1 }, baseline: {}, found: 'allows 0' },
    {
      shape: 'a stale baseline',
      actual: { 'a.ts': 1 },
      baseline: { 'a.ts': 2 },
      found: 'still says 2',
    },
    { shape: 'a file at zero', actual: {}, baseline: { 'a.ts': 1 }, found: 'still says 1' },
  ])('fails the ratchet for $shape', ({ actual, baseline, found }) => {
    const findings = ratchetFindings(actual, baseline);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain(found);
  });

  it('holds the literal status comparisons at the baseline, and fails when it is stale', () => {
    const actual = Object.fromEntries(
      productionSources()
        .map((file) => [file, countStateLiteralCompares(file, read(file))] as const)
        .filter(([, count]) => count > 0)
    );

    expect(ratchetFindings(actual, STATE_LITERAL_COMPARES)).toEqual([]);
  });

  it.each([
    { file: 'AGENTS.md', text: RULE_START },
    { file: '.github/PULL_REQUEST_TEMPLATE.md', text: CHECKLIST_LINE },
  ])('states the rule in $file', ({ file, text }) => {
    expect(read(file)).toContain(text);
  });
});
