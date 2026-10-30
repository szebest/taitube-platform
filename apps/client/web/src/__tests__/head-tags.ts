const JSON_LD = /<script type="application\/ld\+json">(.*?)<\/script>/gs;

export function headOf(html: string): string {
  return html.split('</head>')[0] ?? '';
}

/** Every JSON-LD block in the server HTML, parsed. */
export function jsonLdOf(html: string): unknown[] {
  return [...headOf(html).matchAll(JSON_LD)].map(([, json]) => JSON.parse(json ?? 'null'));
}
