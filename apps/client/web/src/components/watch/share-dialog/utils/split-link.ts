/** The two parts of a link a row shows as `head...tail`, so the end that tells links apart stays visible. */
export function splitLink(link: string, tailLength: number) {
  const cut = Math.max(0, link.length - tailLength);

  return { head: link.slice(0, cut), tail: link.slice(cut) };
}
