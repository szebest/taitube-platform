export const EDIT_TABS = ['details', 'chapters', 'corrections', 'history'] as const;

export type EditTab = (typeof EDIT_TABS)[number];

/** The tab a value names, or `undefined` for anything else. */
export function parseEditTab(value: unknown): EditTab | undefined {
  return EDIT_TABS.find((name) => name === value);
}
