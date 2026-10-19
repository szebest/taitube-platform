import tokens from '../../../../../../docs/design/tokens.json' with { type: 'json' };
import { type TokenGroup, tokenGroups } from '../token-group';

function isRecord(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

function withoutMetadata(node: unknown): unknown {
  if (!isRecord(node)) {
    return node;
  }

  if (Object.hasOwn(node, '$value')) {
    return node.$value;
  }

  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !key.startsWith('$'))
      .map(([key, child]) => [key, withoutMetadata(child)])
  );
}

type TokenSet = [id: string, values: Record<string, unknown>];

function tokenSets(group: TokenGroup): [TokenSet, ...TokenSet[]] {
  const node = withoutMetadata(tokens.set[group]);
  const [first, ...rest] = isRecord(node)
    ? Object.entries(node).filter((entry): entry is TokenSet => isRecord(entry[1]))
    : [];
  if (!first) {
    throw new Error(`tokens.json has no sets under set.${group}`);
  }

  return [first, ...rest];
}

type BrokenSet = [change: string, values: unknown];

function brokenSets(node: unknown, at: string[] = []): BrokenSet[] {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) =>
      brokenSets(child, [...at, String(index)]).map(
        ([change, broken]): BrokenSet => [
          change,
          node.map((sibling, siblingIndex) => (siblingIndex === index ? broken : sibling)),
        ]
      )
    );
  }

  if (!isRecord(node)) {
    return [];
  }

  const [first, ...rest] = Object.entries(node);
  if (!first) {
    return [];
  }

  const [firstKey, firstValue] = first;
  return [
    [`without ${[...at, firstKey].join('.')}`, Object.fromEntries(rest)],
    [`with ${[...at, 'unknown'].join('.')}`, { ...node, unknown: firstValue }],
    ...Object.entries(node).flatMap(([key, child]) =>
      brokenSets(child, [...at, key]).map(
        ([change, broken]): BrokenSet => [change, { ...node, [key]: broken }]
      )
    ),
  ];
}

export function describeTokenGroupContract(group: TokenGroup): void {
  const { schema } = tokenGroups[group];
  const sets = tokenSets(group);
  const [[, firstSet]] = sets;

  it.each(sets)('parses the %s set from tokens.json', (_id, values) => {
    expect(schema.safeParse(values).error).toBeUndefined();
  });

  it.each(brokenSets(firstSet))('rejects the first set %s', (_change, values) => {
    expect(schema.safeParse(values).success).toBe(false);
  });
}
