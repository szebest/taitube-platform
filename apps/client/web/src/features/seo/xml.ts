const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(text: string): string {
  return text.replaceAll(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** `<name>text</name>`, the text escaped. */
export function element(name: string, text: string): string {
  return `<${name}>${escapeXml(text)}</${name}>`;
}

export function xmlResponse(body: string, contentType: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: {
      'content-type': `${contentType}; charset=utf-8`,
      'cache-control': 'public, max-age=300',
    },
  });
}
