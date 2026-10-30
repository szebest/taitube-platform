import { useRouter } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { appearance } from '@vp/ui/appearance/registry';

import { APPEARANCE_MODES, type CommandAction, PLANNED_PAGES } from '../command-actions';

/** Every action the palette can run: a theme and a mode each, the pages whose route exists, and the studio for a creator. */
export function useCommandActions(): CommandAction[] {
  const router = useRouter();
  const canUpload = useCan('create', 'Video');
  const { tOr } = useT();

  const themes = appearance.themes.map(
    ({ id, name }): CommandAction => ({
      kind: 'theme',
      id,
      name,
      label: tOr('search.switchTheme', { name }, ''),
    })
  );
  const modes = APPEARANCE_MODES.map(
    (mode): CommandAction => ({
      kind: 'mode',
      mode,
      label: tOr('search.switchMode', { mode }, ''),
    })
  );
  const pages = PLANNED_PAGES.filter(({ path }) => Object.hasOwn(router.routesByPath, path)).map(
    ({ id, path }): CommandAction => ({
      kind: 'page',
      id,
      path,
      label: tOr('search.openHistory', {}, ''),
    })
  );
  const studio: CommandAction[] = canUpload
    ? [{ kind: 'studio', label: tOr('search.uploadVideo', {}, '') }]
    : [];

  return [...themes, ...modes, ...pages, ...studio];
}
