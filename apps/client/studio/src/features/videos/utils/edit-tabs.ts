const EDIT_TABS = [
  'details',
  'chapters',
  'corrections',
  'sharing',
  'tests',
  'edit',
  'history',
] as const;

type EditTab = (typeof EDIT_TABS)[number];

/** The tab a value names, or `undefined` for anything else. */
export function parseEditTab(value: unknown): EditTab | undefined {
  return EDIT_TABS.find((name) => name === value);
}
