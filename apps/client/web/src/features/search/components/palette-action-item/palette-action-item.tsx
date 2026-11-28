import { assertNever, fromPromise, isOk } from '@kit/result';
import { Icon, type IconId, useAppearance, useToast } from '@kit/ui';
import { useRouter } from '@tanstack/react-router';
import { useAppLink } from '@vp/queries';
import { CommandPalette } from '#app/components/shell/command-palette';
import type { CommandAction } from '#app/features/search/utils/command-actions';
import { parsePartyLink } from '#app/features/search/utils/party-link';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useCommandPaletteStore } from '#app/lib/command-palette/command-palette-store';
import { STUDIO_URL } from '#app/lib/config';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

const ICONS: Record<CommandAction['kind'], IconId> = {
  theme: 'moon',
  mode: 'sun',
  page: 'history',
  studio: 'upload',
  'party-start': 'party',
  'party-join': 'party',
};

const KIND_WORD = {
  theme: 'theme',
  mode: 'mode',
  page: 'page',
  'party-start': 'party',
  'party-join': 'party',
} as const satisfies Partial<Record<CommandAction['kind'], string>>;

export interface PaletteActionItemProps {
  action: CommandAction;
}

/** An action beside the results: it changes the appearance, or opens a page, and closes the palette. */
export function PaletteActionItem({ action }: PaletteActionItemProps) {
  const { setOpen } = useCommandPaletteStore();
  const { update } = useAppearance();
  const router = useRouter();
  const appLink = useAppLink();
  const { tOr } = useT();
  const { run: asAccount } = useRequireAccount('party');
  const { open: openWatchTogether } = urlModals.useUrlModal('watch-together');
  const showToast = useToast();

  const joinFromClipboard = async () => {
    const copied = await fromPromise(
      () => navigator.clipboard.readText(),
      (cause) => cause
    );
    const link = isOk(copied) ? parsePartyLink(copied.value) : undefined;
    if (!link) {
      showToast({ tone: 'danger', title: tOr('search.noPartyLink', {}, '') });
      return;
    }
    await router.navigate({
      to: '/parties/$roomId',
      params: { roomId: link.roomId },
      search: link.invite ? { invite: link.invite } : {},
    });
  };

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
        window.location.assign(appLink(STUDIO_URL));
        return;
      case 'party-start':
        asAccount(() => openWatchTogether({}));
        return;
      case 'party-join':
        void joinFromClipboard();
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
        action.kind === 'studio'
          ? undefined
          : tOr('search.actionKind', { kind: KIND_WORD[action.kind] }, '')
      }
    >
      {action.label}
    </CommandPalette.Item>
  );
}
