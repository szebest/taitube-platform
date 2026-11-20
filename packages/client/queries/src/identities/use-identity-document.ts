import { useT } from '@kit/intl-react';
import { fromPromise, isOk } from '@kit/result';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import { identityKey } from '../account-slots';
import type { Accent } from '../accounts';
import { useIdentity } from '../session-provider';
import { accountsListQueryOptions } from './identity-queries';
import { useIdentityChoices } from './use-identity-choices';

const ICON = 'link[rel="icon"][type="image/svg+xml"]';

/** The app's own icon with a dot in the identity's accent, read from the page's computed palette. */
async function dottedIcon(href: string, accent: Accent): Promise<string | undefined> {
  const fetched = await fromPromise(
    async () => (await fetch(href)).text(),
    (cause) => cause
  );
  if (!isOk(fetched)) return undefined;
  const colour = getComputedStyle(document.documentElement)
    .getPropertyValue(`--dataviz-categorical-${accent}`)
    .trim();
  const dot = `<circle cx="25" cy="7" r="6.5" fill="${colour || 'currentColor'}"/>`;
  const svg = fetched.value.replace(/<\/svg>\s*$/, `${dot}</svg>`);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function usePrefixedTitle(handle: string | undefined): void {
  const { tOr } = useT();
  const prefixed = useEffectEvent((title: string, named: string) =>
    tOr('accounts.tabTitle', { handle: named, title }, title)
  );

  useEffect(() => {
    if (handle === undefined) return;
    let base = document.title;
    const apply = () => {
      if (document.title === prefixed(base, handle)) return;
      base = document.title;
      document.title = prefixed(base, handle);
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = base;
    };
  }, [handle]);
}

function useDottedIcon(accent: Accent | undefined): void {
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>(ICON);
    if (!accent || !icon) return;
    const original = icon.getAttribute('href') ?? '';
    let live = true;
    void dottedIcon(original, accent).then((dotted) => {
      if (live && dotted) icon.href = dotted;
    });
    return () => {
      live = false;
      icon.setAttribute('href', original);
    };
  }, [accent]);
}

/**
 * A tab acting as anything but the browser's default identity says so outside the page too: its
 * title starts with the handle, and its icon carries a dot in the identity's accent.
 */
export function useIdentityDocument(): void {
  const tab = useIdentity();
  const accounts = useQuery(accountsListQueryOptions()).data;
  const { current } = useIdentityChoices(false);

  const defaultRow = accounts?.slots.find(({ slot }) => slot === accounts.defaultSlot);
  const defaultKey =
    accounts &&
    identityKey({ slot: accounts.defaultSlot, channel: defaultRow?.channel ?? undefined });
  const elsewhere = defaultKey !== undefined && identityKey(tab) !== defaultKey;
  const handle = elsewhere ? current?.handle : undefined;

  usePrefixedTitle(handle);
  useDottedIcon(elsewhere ? current?.accent : undefined);
}
