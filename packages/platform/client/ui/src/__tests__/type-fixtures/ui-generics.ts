import type { ComponentProps, Context } from 'react';
import { createCompoundContext, lazyComponent, variantNames } from '../../index';

const [context, useCard] = createCompoundContext<{ open: boolean }>('Card');

expectTypeOf(context).toEqualTypeOf<Context<{ open: boolean } | undefined>>();
expectTypeOf(useCard()).toEqualTypeOf<{ open: boolean }>();
expectTypeOf(useCard).parameters.toEqualTypeOf<[part?: string]>();

// @ts-expect-error the root name is a string
createCompoundContext<number>(1);

const Greeting = (props: { name: string }) => props.name;

const Lazy = lazyComponent(() => Promise.resolve({ Greeting }), {
  name: 'Greeting',
  pick: (module) => module.Greeting,
});

expectTypeOf(Lazy.preload).toEqualTypeOf<() => Promise<void>>();
expectTypeOf<ComponentProps<typeof Lazy>>().toEqualTypeOf<{ name: string }>();

lazyComponent(() => Promise.resolve({ Greeting }), {
  name: 'Greeting',
  // @ts-expect-error pick returns a component, not a string
  pick: () => 'Greeting',
});

lazyComponent(() => Promise.resolve({ Greeting }), {
  name: 'Greeting',
  pick: (module) => {
    // @ts-expect-error the module has no such export
    return module.Missing;
  },
});

expectTypeOf(variantNames({ sm: 1, md: 2 })).toEqualTypeOf<('sm' | 'md')[]>();

// @ts-expect-error a variant is an object of looks
variantNames('sm');
