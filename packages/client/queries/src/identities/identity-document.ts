import { fromPromise, isOk } from '@kit/result';
import type { Accent } from '../accounts';

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

function prefixTitle(prefixed: (title: string) => string): () => void {
  let base = document.title;
  const apply = () => {
    if (document.title === prefixed(base)) return;
    base = document.title;
    document.title = prefixed(base);
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.head, { subtree: true, childList: true, characterData: true });
  return () => {
    observer.disconnect();
    document.title = base;
  };
}

function dotIcon(accent: Accent): () => void {
  const icon = document.querySelector<HTMLLinkElement>(ICON);
  if (!icon) return () => undefined;
  const original = icon.getAttribute('href') ?? '';
  let live = true;
  void dottedIcon(original, accent).then((dotted) => {
    if (live && dotted) icon.href = dotted;
  });
  return () => {
    live = false;
    icon.setAttribute('href', original);
  };
}

/**
 * Marks the document of a tab off the browser's default identity: every title the page sets starts
 * with the identity's handle, and the icon carries a dot in its accent. Answers the undo.
 */
export function markDocument(prefixed: (title: string) => string, accent: Accent): () => void {
  const untitle = prefixTitle(prefixed);
  const undot = dotIcon(accent);
  return () => {
    untitle();
    undot();
  };
}
