import { type DefaultTreeAdapterMap, parse, serializeOuter } from 'parse5';

type Element = DefaultTreeAdapterMap['element'];
type ChildNode = DefaultTreeAdapterMap['childNode'];

function isElement(node: ChildNode): node is Element {
  return 'tagName' in node;
}

function descendants(node: { childNodes?: ChildNode[] }): Element[] {
  return (node.childNodes ?? []).flatMap((child) =>
    isElement(child) ? [child, ...descendants(child)] : []
  );
}

function headElement(html: string): Element | undefined {
  return descendants(parse(html)).find((element) => element.tagName === 'head');
}

/** The document's `<head>`, as the server wrote it. */
export function headOf(html: string): string {
  const head = headElement(html);
  return head ? serializeOuter(head) : '';
}

/** Every JSON-LD block in the server HTML, parsed. */
export function jsonLdOf(html: string): unknown[] {
  const head = headElement(html);
  const scripts = descendants(head ?? { childNodes: [] }).filter(
    (element) =>
      element.tagName === 'script' &&
      element.attrs.some(({ name, value }) => name === 'type' && value === 'application/ld+json')
  );
  return scripts.map((script) =>
    JSON.parse(script.childNodes.map((node) => ('value' in node ? node.value : '')).join(''))
  );
}
