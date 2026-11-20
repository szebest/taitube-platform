import { useT } from '@kit/intl-react';
import { isOk } from '@kit/result';
import { VisuallyHidden } from '@kit/ui';
import { useRouter } from '@tanstack/react-router';
import { type PropsWithChildren, createContext, useContext, useEffect, useState } from 'react';
import type { Identity } from '../account-slots';
import type { Accent } from '../accounts';
import { failureCode } from '../failure-code';
import { present } from '../present-failure';

/** What the header shows of an identity: enough to draw it before its session has loaded. */
export type IdentityDisplay = {
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly accent: Accent;
};

export type SwitchTarget = {
  readonly identity: Identity;
  /** Whether the tab's URLs carry the prefix once there. */
  readonly prefixed: boolean;
  readonly display: IdentityDisplay;
};

/** Which of the switcher's surfaces is open: the searchable list, or the new channel form. */
export type SwitcherPanel = 'closed' | 'switcher' | 'create-channel';

type IdentitySwitcherValue = {
  panel: SwitcherPanel;
  show: (panel: SwitcherPanel) => void;
  /** The identity a switch is on its way to, drawn in the header before the network answers. */
  pending: IdentityDisplay | undefined;
  /** Switches the tab in place; `from` is what Undo goes back to. */
  switchTo: (target: SwitchTarget, from?: SwitchTarget) => Promise<void>;
};

/** The switch itself loads with the first switch, not with the page. */
const loadSwitchFlow = () => import('./switch-flow');

const IdentitySwitcherContext = createContext<IdentitySwitcherValue | undefined>(undefined);

/** `Alt+Shift+A`, by the key's place rather than its letter, so a layout that types another character there still opens it. */
function isSwitcherShortcut(event: KeyboardEvent): boolean {
  return (
    event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyA'
  );
}

/** After a switch the page's heading takes focus, so a screen reader starts from the new page. */
function focusMainHeading(): void {
  requestAnimationFrame(() => {
    const heading =
      document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  });
}

export type IdentitySwitcherProviderProps = PropsWithChildren<{
  /** Where a switch lands when the new identity cannot see the page: the app's home. */
  fallback: string;
}>;

/**
 * Holds the switcher above the session, so its state and its live region outlive the remount a
 * switch causes: which surface is open, the identity on its way, the shortcut, and after a switch
 * the toast with Undo, the polite announcement and focus on the page's heading. A failed switch is
 * rolled back and toasts its reason.
 */
export function IdentitySwitcherProvider({ fallback, children }: IdentitySwitcherProviderProps) {
  const router = useRouter();
  const { tOr } = useT();
  const [panel, show] = useState<SwitcherPanel>('closed');
  const [pending, setPending] = useState<IdentityDisplay>();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSwitcherShortcut(event)) return;
      event.preventDefault();
      show('switcher');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const switchTo = async (target: SwitchTarget, from?: SwitchTarget): Promise<void> => {
    const { name } = target.display;
    show('closed');
    setPending(target.display);
    setAnnouncement('');
    const state = { identity: target.identity, prefixed: target.prefixed };
    const { switchInPlace } = await loadSwitchFlow();
    const outcome = await switchInPlace(router, state, fallback);
    setPending(undefined);
    const { toaster } = router.options.context;
    if (!isOk(outcome)) {
      toaster.show({
        tone: 'danger',
        title: tOr('accounts.switchFailed', { name }, ''),
        description: tOr(present({ code: failureCode(outcome.error) }).copy, {}, ''),
      });
      return;
    }
    const said = tOr('accounts.nowBrowsing', { name }, '');
    setAnnouncement(said);
    focusMainHeading();
    toaster.show({
      title: said,
      action: from && {
        label: tOr('accounts.undo', {}, ''),
        onAction: () => void switchTo(from, target),
      },
    });
  };

  return (
    <IdentitySwitcherContext value={{ panel, show, pending, switchTo }}>
      {children}
      <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
    </IdentitySwitcherContext>
  );
}

/**
 * Renders `children` from the first time a switcher surface opens on, so the dialog, its search and
 * the new channel form load with that first open rather than with the page.
 */
export function WhenSwitcherOpened({ children }: PropsWithChildren) {
  const { panel } = useIdentitySwitcher();
  const [opened, setOpened] = useState(false);
  if (panel !== 'closed' && !opened) setOpened(true);

  return opened ? children : null;
}

const CLOSED: IdentitySwitcherValue = {
  panel: 'closed',
  show: () => undefined,
  pending: undefined,
  switchTo: async () => undefined,
};

/**
 * The switcher of the app's root. A part drawn alone, outside an app's root (a page in a spec, a
 * story), gets one that stays closed and switches nothing.
 */
export function useIdentitySwitcher(): IdentitySwitcherValue {
  return useContext(IdentitySwitcherContext) ?? CLOSED;
}
