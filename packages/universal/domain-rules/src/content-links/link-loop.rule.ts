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
 * Adding `source -> target` closes a loop when `source` is already reachable from `target`. The
 * search runs from `source` over the reversed edges, so a new link at the end of a long chain,
 * whose source has nothing pointing at it, is never walked. The walk stops at
 * `LINK_CHAIN_MAX_DEPTH`, and a chain that deep above `source` is refused as if it looped.
 */
export function decideLinkLoop(input: LinkLoopInput): Result<void, LinkLoop> {
  const { relation, source, target, edges } = input;
  if (!RELATIONS[relation].chain) return ok(undefined);

  const pointedAtBy = new Map<string, string[]>();
  for (const [from, targets] of edges) {
    for (const to of targets) pointedAtBy.set(to, [...(pointedAtBy.get(to) ?? []), from]);
  }

  const goal = contentRefKey(target);
  let frontier = [contentRefKey(source)];
  const seen = new Set(frontier);
  for (let depth = 0; depth < LINK_CHAIN_MAX_DEPTH && frontier.length > 0; depth += 1) {
    if (frontier.includes(goal)) return err(linkLoop(relation));
    frontier = frontier
      .flatMap((key) => pointedAtBy.get(key) ?? [])
      .filter((key) => !seen.has(key) && seen.add(key));
  }
  return frontier.length > 0 ? err(linkLoop(relation)) : ok(undefined);
}
