import { useRouter } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { assertNever } from '@vp/result';
import { Icon, type IconId, useAppearance } from '@vp/ui';

import { CommandPalette } from '#app/components/shell/command-palette';
import { STUDIO_URL } from '#app/config';
import type { CommandAction } from '../command-actions';
import { useCommandPaletteStore } from '../command-palette-store';

const ICONS: Record<CommandAction['kind'], IconId> = {
  theme: 'moon',
  mode: 'sun',
  page: 'history',
  studio: 'upload',
};

export interface PaletteActionItemProps {
  action: CommandAction;
}

/** An action beside the results: it changes the appearance, or opens a page, and closes the palette. */
export function PaletteActionItem({ action }: PaletteActionItemProps) {
  const { setOpen } = useCommandPaletteStore();
  const { update } = useAppearance();
  const router = useRouter();
  const { tOr } = useT();

  const run = () => {
    setOpen(false);
    switch (action.kind) {
      case 'theme':
        update({ theme: action.id });
        return;
      case 'mode':
        update({ mode: action.mode });
        return;
      case 'page':
        router.history.push(action.path);
        return;
      case 'studio':
        window.location.assign(STUDIO_URL);
        return;
      default:
        assertNever(action, 'command action');
    }
  };

  return (
    <CommandPalette.Item
      value={`action:${action.kind}:${action.label}`}
      onSelect={run}
      leading={<Icon name={ICONS[action.kind]} />}
      meta={
        action.kind === 'studio' ? undefined : tOr('search.actionKind', { kind: action.kind }, '')
      }
    >
      {action.label}
    </CommandPalette.Item>
  );
}
