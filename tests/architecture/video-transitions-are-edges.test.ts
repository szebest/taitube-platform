import { SCREENING_TRANSITIONS } from '@vp/domain';
import { VIDEO_LIFECYCLE } from '@vp/domain-rules';
import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { productionSources, read } from './repo-files';

const NAMED_SOURCES: Readonly<Record<string, readonly string[]>> = {
  REPROCESSABLE_STATUSES: VIDEO_LIFECYCLE.sources('reprocess'),
  DELETABLE_STATUSES: VIDEO_LIFECYCLE.sources('delete'),
};

const SCREENING_NAMES: readonly string[] = Object.keys(SCREENING_TRANSITIONS);

function property(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const member of object.properties) {
    if (ts.isPropertyAssignment(member) && member.name.getText() === name)
      return member.initializer;
  }
  return undefined;
}

function screeningEdgeOf(sourceFile: ts.SourceFile, identifier: string): string | undefined {
  let found: string | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === identifier &&
      node.initializer !== undefined &&
      ts.isPropertyAccessExpression(node.initializer) &&
      node.initializer.expression.getText() === 'SCREENING_TRANSITIONS' &&
      SCREENING_NAMES.includes(node.initializer.name.text)
    ) {
      found = node.initializer.name.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function valuesOf(
  sourceFile: ts.SourceFile,
  expression: ts.Expression
): readonly string[] | undefined {
  if (ts.isStringLiteralLike(expression)) return [expression.text];
  if (ts.isIdentifier(expression)) return NAMED_SOURCES[expression.text];
  if (ts.isArrayLiteralExpression(expression)) {
    const values: string[] = [];
    for (const element of expression.elements) {
      const resolved = ts.isSpreadElement(element)
        ? valuesOf(sourceFile, element.expression)
        : valuesOf(sourceFile, element);
      if (resolved === undefined) return undefined;
      values.push(...resolved);
    }
    return values;
  }
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    const edge = screeningEdgeOf(sourceFile, expression.expression.text);
    const side = expression.name.text;
    if (edge !== undefined && (side === 'from' || side === 'to')) {
      return [SCREENING_TRANSITIONS[edge as keyof typeof SCREENING_TRANSITIONS][side]];
    }
  }
  return undefined;
}

const isVideos = (node: ts.Expression): boolean =>
  (ts.isIdentifier(node) && node.text === 'videos') ||
  (ts.isPropertyAccessExpression(node) && node.name.text === 'videos');

function isTransitionCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  return (
    (ts.isPropertyAccessExpression(callee) &&
      callee.name.text === 'transition' &&
      isVideos(callee.expression)) ||
    (ts.isIdentifier(callee) && callee.text === 'commitVideoTransition')
  );
}

/** Every edge a call names that is not in the table, every pair it writes that is not an edge, and every pair it cannot read. */
function nonEdges(file: string, source: string): { checked: number; problems: string[] } {
  const sourceFile = parseSource(file, source);
  const problems: string[] = [];
  let checked = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isTransitionCall(node)) {
      for (const argument of node.arguments) {
        if (!ts.isObjectLiteralExpression(argument)) continue;
        const edge = property(argument, 'edge');
        if (edge !== undefined) {
          checked += 1;
          if (
            !ts.isStringLiteralLike(edge) ||
            !VIDEO_LIFECYCLE.eventNames.some((name) => name === edge.text)
          ) {
            problems.push(`${file}: ${edge.getText()} is not an edge of VIDEO_LIFECYCLE`);
          }
          continue;
        }
        const from = property(argument, 'from');
        const to = property(argument, 'to');
        if (from === undefined || to === undefined) continue;

        checked += 1;
        const sources = valuesOf(sourceFile, from);
        const targets = valuesOf(sourceFile, to);
        if (sources === undefined || targets === undefined) {
          problems.push(
            `${file}: ${node.getText().split('\n')[0]} is not a literal pair, use VIDEO_LIFECYCLE.sources(...)`
          );
          continue;
        }
        for (const source of sources) {
          for (const target of targets) {
            const state = VIDEO_LIFECYCLE.states.find((candidate) => candidate === source);
            const next = VIDEO_LIFECYCLE.states.find((candidate) => candidate === target);
            if (
              state === undefined ||
              next === undefined ||
              !VIDEO_LIFECYCLE.hasEdge(state, next)
            ) {
              problems.push(`${file}: ${source} to ${target} is not an edge of VIDEO_LIFECYCLE`);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { checked, problems };
}

describe('architecture: video transitions are edges of VIDEO_LIFECYCLE', () => {
  it.each([
    {
      shape: 'a named edge',
      source: "videos.transition({ videoId, edge: 'takedown' });",
    },
    {
      shape: 'a literal pair',
      source: "videos.transition({ videoId, from: 'UPLOADING', to: 'UPLOADED' });",
    },
    {
      shape: 'a list with a named spread',
      source: "videos.transition({ videoId, from: [...REPROCESSABLE_STATUSES], to: 'PROBING' });",
    },
    {
      shape: 'a named list',
      source: "commitVideoTransition(tx, { videoId, from: DELETABLE_STATUSES, to: 'DELETED' });",
    },
    {
      shape: 'a screening edge',
      source:
        'const edge = SCREENING_TRANSITIONS.hold;\nvideos.transition({ videoId, from: edge.from, to: edge.to });',
    },
  ])('accepts $shape', ({ source }) => {
    expect(nonEdges('fixture.ts', source)).toMatchObject({ checked: 1, problems: [] });
  });

  it('leaves the transition of another table alone', () => {
    expect(nonEdges('fixture.ts', 'dlq.transition({ id, from: allowed, to: next });')).toEqual({
      checked: 0,
      problems: [],
    });
  });

  it.each([
    {
      shape: 'a pair that is not an edge',
      source: "videos.transition({ videoId, from: 'READY', to: 'UPLOADING' });",
      problem: 'READY to UPLOADING is not an edge of VIDEO_LIFECYCLE',
    },
    {
      shape: 'one illegal source in a list',
      source: "videos.transition({ videoId, from: ['UPLOADING', 'READY'], to: 'PROBING' });",
      problem: 'UPLOADING to PROBING is not an edge',
    },
    {
      shape: 'an edge that is not in the table',
      source: "videos.transition({ videoId, edge: 'resurrect' });",
      problem: "'resurrect' is not an edge of VIDEO_LIFECYCLE",
    },
    {
      shape: 'a pair it cannot read',
      source: 'videos.transition({ videoId, from: allowed, to: next });',
      problem: 'use VIDEO_LIFECYCLE.sources(...)',
    },
  ])('flags $shape', ({ source, problem }) => {
    const { problems } = nonEdges('fixture.ts', source);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(problem);
  });

  it('checks every transition call in production source, and finds them', () => {
    const results = productionSources().map((file) => nonEdges(file, read(file)));

    expect(results.flatMap((result) => result.problems)).toEqual([]);
    expect(results.reduce((total, result) => total + result.checked, 0)).toBeGreaterThanOrEqual(19);
  });
});
