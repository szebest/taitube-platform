export type PickOfTheDayLayout = 'default' | 'stacked';

/** What an omitted `layout` resolves to: `stacked` below the expanded breakpoint, `default` from it. */
export type PickOfTheDayLayoutStyle = PickOfTheDayLayout | 'responsive';
