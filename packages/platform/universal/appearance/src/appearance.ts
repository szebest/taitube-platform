export const MODE_OPTIONS = ['system', 'dark', 'light', 'oled'] as const;

export type ModeOption = (typeof MODE_OPTIONS)[number];

export const DEFAULT_MODE = 'system' satisfies ModeOption;

/** `auto` follows the system's `prefers-contrast` until the viewer picks one. */
export const CONTRAST_OPTIONS = ['auto', 'standard', 'more'] as const;

export type ContrastOption = (typeof CONTRAST_OPTIONS)[number];

export const DEFAULT_CONTRAST = 'auto' satisfies ContrastOption;

/** Theme and token-set ids. A store that knows no registry keeps any id of this shape. */
export const PREFERENCE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
/** Token group names, camelCase because `fontSize` is one. */
export const TOKEN_GROUP_PATTERN = /^[a-z][a-zA-Z0-9]{0,31}$/;
export const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;
export const MAX_APPEARANCE_OVERRIDES = 16;
