export const REVIEW_MODES = ['none', 'links', 'all'] as const;

export type ReviewMode = (typeof REVIEW_MODES)[number];

export const DISCLOSURES = ['silent', 'visible'] as const;

/** What the author of a moderated comment is told: nothing, or the state and its reason. */
export type Disclosure = (typeof DISCLOSURES)[number];

/** One default per moderator action and per automatic hold. */
export const DISCLOSURE_RULES = [
  'hide',
  'remove',
  'manual_hold',
  'auto.blocked_words',
  'auto.links',
  'auto.review_all',
] as const;

export type DisclosureRule = (typeof DISCLOSURE_RULES)[number];

export type DisclosureDefaults = Readonly<Record<DisclosureRule, Disclosure>>;

export interface CommentSettings {
  reviewMode: ReviewMode;
  blockedWords: readonly string[];
  linkAllowlist: readonly string[];
  slowModeSeconds: number | null;
  subscribersOnly: boolean;
  minAccountAgeDays: number;
  disclosure: DisclosureDefaults;
}

export const DEFAULT_DISCLOSURE: DisclosureDefaults = {
  hide: 'silent',
  remove: 'visible',
  manual_hold: 'visible',
  'auto.blocked_words': 'silent',
  'auto.links': 'visible',
  'auto.review_all': 'visible',
};

export const DEFAULT_COMMENT_SETTINGS: CommentSettings = {
  reviewMode: 'none',
  blockedWords: [],
  linkAllowlist: [],
  slowModeSeconds: null,
  subscribersOnly: false,
  minAccountAgeDays: 0,
  disclosure: DEFAULT_DISCLOSURE,
};
