import tokens from '../../../../../../docs/design/tokens.json' with { type: 'json' };
import type { TokenGroupDefinition } from '../token-group';

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

type TokenGroupKey = Exclude<keyof typeof tokens.set, '$description'>;

function tokenSets(group: TokenGroupKey): [TokenSet, ...TokenSet[]] {
  const node = withoutMetadata(tokens.set[group]);
  const [first, ...rest] = isRecord(node)
    ? Object.entries(node).filter((entry): entry is TokenSet => isRecord(entry[1]))
    : [];
  if (!first) {
    throw new Error(`tokens.json has no sets under set.${group}`);
  }

  return [first, ...rest];
}

function withoutFirstKey(values: Record<string, unknown>): Record<string, unknown> {
  const [, ...rest] = Object.entries(values);
  return Object.fromEntries(rest);
}

function withUnknownKey(values: Record<string, unknown>): Record<string, unknown> {
  return { ...values, unknown: Object.values(values)[0] };
}

export function describeTokenGroupContract(
  group: TokenGroupKey,
  { schema }: TokenGroupDefinition
): void {
  const sets = tokenSets(group);
  const [[, firstSet]] = sets;

  it.each(sets)('parses the %s set from tokens.json', (_id, values) => {
    expect(schema.safeParse(values).error).toBeUndefined();
  });

  it.each([
    ['missing a key', withoutFirstKey],
    ['with an unknown key', withUnknownKey],
  ])('rejects a set %s', (_label, mutate) => {
    expect(schema.safeParse(mutate(firstSet)).success).toBe(false);
  });
}
