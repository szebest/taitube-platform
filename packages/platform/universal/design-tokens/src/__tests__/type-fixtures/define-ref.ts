import { defineRef } from '../../define';
import type { RefKey } from '../../schema/ref';

const palette = defineRef({
  sand: { '50': '#fafafa', '900': '#111111' },
  ink: { '500': '#555555' },
});

expectTypeOf<RefKey<typeof palette.ramps>>().toEqualTypeOf<'sand.50' | 'sand.900' | 'ink.500'>();

palette.ref('sand.50');

// @ts-expect-error a step the ramp does not hold
palette.ref('sand.100');

// @ts-expect-error a ramp the palette does not hold
palette.ref('moss.50');

// @ts-expect-error a step is a hex colour
defineRef({ sand: { '50': 'white' } });
