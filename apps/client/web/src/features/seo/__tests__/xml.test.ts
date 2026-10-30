import { element, escapeXml, xmlResponse } from '../xml';

describe('apps/client/web: xml', () => {
  it('escapes the five characters XML reserves', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;'
    );
  });

  it('wraps escaped text in an element', () => {
    expect(element('title', 'A & B')).toBe('<title>A &amp; B</title>');
  });

  it('answers a document with its declaration, content type and a short cache', async () => {
    const response = xmlResponse('<a/>', 'application/xml');

    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(await response.text()).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<a/>');
  });
});
