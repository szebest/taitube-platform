/** The address when it is an `https` URL, else `undefined`: a link the page draws never carries another scheme. */
export function httpsUrl(raw: string): string | undefined {
  if (!URL.canParse(raw)) return undefined;
  const { protocol, href } = new URL(raw);
  return protocol === 'https:' ? href : undefined;
}
