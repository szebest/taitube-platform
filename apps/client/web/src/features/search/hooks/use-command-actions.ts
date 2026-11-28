import { appearance } from '@kit/ui/appearance/registry';
import { useRouter } from '@tanstack/react-router';
import { useCan } from '@vp/permissions-react';
import { useT } from '#app/lib/messages';
import { APPEARANCE_MODES, type CommandAction, PLANNED_PAGES } from '../utils/command-actions';

const PAGE_LABELS = {
  history: 'search.openHistory',
  parties: 'search.browseParties',
} as const;

/** Every action the palette can run: a theme and a mode each, the pages whose route exists, and the studio for a creator. */
export function useCommandActions(): CommandAction[] {
  const router = useRouter();
  const canUpload = useCan('create', 'Video');
  const { tOr } = useT();

  const themes = appearance.themes.map(({ id, name }): CommandAction => ({
    kind: 'theme',
    id,
    name,
    label: tOr('search.switchTheme', { name }, ''),
  }));
  const modes = APPEARANCE_MODES.map((mode): CommandAction => ({
    kind: 'mode',
    mode,
    label: tOr('search.switchMode', { mode }, ''),
  }));
  const pages = PLANNED_PAGES.filter(({ path }) => Object.hasOwn(router.routesByPath, path)).map(
    ({ id, path }): CommandAction => ({
      kind: 'page',
      id,
      path,
      label: tOr(PAGE_LABELS[id], {}, ''),
    })
  );
  const studio: CommandAction[] = canUpload
    ? [{ kind: 'studio', label: tOr('search.uploadVideo', {}, '') }]
    : [];

  return [...themes, ...modes, ...pages, ...studio];
}
