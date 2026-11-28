import { type Result, err, ok } from '@kit/result';
import {
  type ContentLinkRelation,
  type ContentRef,
  LINK_CHAIN_MAX_DEPTH,
  RELATIONS,
  contentRefKey,
} from '@vp/domain';
import { type LinkLoop, linkLoop } from './failures';

export interface LinkLoopInput {
  readonly relation: ContentLinkRelation;
  readonly source: ContentRef;
  readonly target: ContentRef;
  /** The chain edges of this relation that already exist, from each ref key to the keys it points at. */
  readonly edges: ReadonlyMap<string, readonly string[]>;
}

/**
 * Adding `source -> target` closes a loop when `target` already reaches `source`. The walk stops at
 * `LINK_CHAIN_MAX_DEPTH`, and a chain that deep is refused as if it looped.
 */
export function decideLinkLoop(input: LinkLoopInput): Result<void, LinkLoop> {
  const { relation, source, target, edges } = input;
  if (!RELATIONS[relation].chain) return ok(undefined);

  const goal = contentRefKey(source);
  let frontier = [contentRefKey(target)];
  const seen = new Set(frontier);
  for (let depth = 0; depth < LINK_CHAIN_MAX_DEPTH && frontier.length > 0; depth += 1) {
    if (frontier.includes(goal)) return err(linkLoop(relation));
    frontier = frontier
      .flatMap((key) => edges.get(key) ?? [])
      .filter((key) => !seen.has(key) && seen.add(key));
  }
  return frontier.length > 0 ? err(linkLoop(relation)) : ok(undefined);
}
