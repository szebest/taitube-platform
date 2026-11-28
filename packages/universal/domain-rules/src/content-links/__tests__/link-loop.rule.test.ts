import { isErr, isOk } from '@kit/result';
import type { ContentLinkRelation } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { decideLinkLoop } from '../link-loop.rule';

const v = (id: string) => ({ type: 'video' as const, id });
const chain = (length: number) =>
  new Map(Array.from({ length }, (_, i) => [`video:${i}`, [`video:${i + 1}`]] as const));

describe('@vp/domain-rules: decideLinkLoop', () => {
  it.each<{
    scenario: string;
    relation: ContentLinkRelation;
    edges: Map<string, readonly string[]>;
    source: string;
    target: string;
    loops: boolean;
  }>([
    {
      scenario: 'b -> a when a -> b exists',
      relation: 'previous',
      edges: new Map([['video:a', ['video:b']]]),
      source: 'b',
      target: 'a',
      loops: true,
    },
    {
      scenario: 'a three-step cycle',
      relation: 'part_of',
      edges: new Map([
        ['video:b', ['video:c']],
        ['video:c', ['video:a']],
      ]),
      source: 'a',
      target: 'b',
      loops: true,
    },
    {
      scenario: 'a straight chain',
      relation: 'follow_up',
      edges: new Map([['video:b', ['video:c']]]),
      source: 'a',
      target: 'b',
      loops: false,
    },
    {
      scenario: 'a relation that never chains',
      relation: 'related',
      edges: new Map([['video:a', ['video:b']]]),
      source: 'b',
      target: 'a',
      loops: false,
    },
    {
      scenario: 'a chain deeper than 50',
      relation: 'previous',
      edges: chain(60),
      source: 'x',
      target: '0',
      loops: true,
    },
  ])('$scenario loops: $loops', ({ relation, edges, source, target, loops }) => {
    const result = decideLinkLoop({ relation, source: v(source), target: v(target), edges });
    if (loops) expect(isErr(result) && result.error.code).toBe(ErrorCodes.LINK_LOOP);
    else expect(isOk(result)).toBe(true);
  });
});
