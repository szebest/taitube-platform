import type { FlowJobNode, FlowProducerPort } from '../../flow-producer';

expectTypeOf<FlowJobNode<{ videoId: string }>['data']>().toEqualTypeOf<{ videoId: string }>();
expectTypeOf<FlowJobNode['children']>().toEqualTypeOf<FlowJobNode[] | undefined>();
expectTypeOf<Parameters<FlowProducerPort['add']>[0]>().toEqualTypeOf<FlowJobNode>();

// @ts-expect-error a node names the queue its job goes to
const _noQueue: FlowJobNode = { name: 'n', data: 1 };
