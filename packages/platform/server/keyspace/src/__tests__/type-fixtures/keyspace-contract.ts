import { type KeyLayout, type MakeKeyspace, describeKeyspaceContract } from '../../contract';
import { defineKeyspace } from '../../index';

const keys = defineKeyspace('app', (key) => ({
  feed: key('feed'),
  user: (id: string) => key('user', id),
}));

expectTypeOf(keys).toExtend<KeyLayout>();
expectTypeOf<ReturnType<MakeKeyspace>>().toEqualTypeOf<KeyLayout>();

describeKeyspaceContract(() => keys);

// @ts-expect-error a layout holds strings or functions building one, not numbers
const _numeric: KeyLayout = { feed: 1 };

// @ts-expect-error a key builder returns a string
const _builder: KeyLayout = { user: (id: string) => id.length };

// @ts-expect-error the suite takes a factory of a layout, not the layout
describeKeyspaceContract(keys);
