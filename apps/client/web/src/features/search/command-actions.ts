import type { AppearancePreference } from '@vp/ui';

export type AppearanceMode = AppearancePreference['mode'];

type ActionKind =
  | { kind: 'theme'; id: string; name: string }
  | { kind: 'mode'; mode: AppearanceMode }
  | { kind: 'page'; id: 'history'; path: string }
  | { kind: 'studio' };

/** What runs, and the words it is listed and matched by. */
export type CommandAction = ActionKind & { label: string };

const MODES: Record<AppearanceMode, true> = { system: true, dark: true, light: true, oled: true };

export const APPEARANCE_MODES = Object.keys(MODES) as AppearanceMode[];

/** A page action is offered once its route is in the tree. */
export const PLANNED_PAGES = [{ id: 'history', path: '/feed/history' }] as const;
