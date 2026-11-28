import type { Ref, RefCallback } from 'react';
import { useSlidingIndicator } from '../../lib/sliding-indicator';

expectTypeOf(useSlidingIndicator<HTMLDivElement>).returns.toEqualTypeOf<
  RefCallback<HTMLDivElement>
>();
expectTypeOf(useSlidingIndicator<HTMLUListElement>)
  .parameter(1)
  .toEqualTypeOf<Ref<HTMLUListElement> | undefined>();

declare const listRef: Ref<HTMLUListElement>;

expectTypeOf(useSlidingIndicator('[data-state=on]', listRef)).toEqualTypeOf<
  RefCallback<HTMLUListElement>
>();

// @ts-expect-error the caller's ref is for the same element type the indicator measures
useSlidingIndicator<HTMLDivElement>('[data-state=on]', listRef);

// @ts-expect-error the container is an element, not any type
useSlidingIndicator<number>('[data-state=on]');
