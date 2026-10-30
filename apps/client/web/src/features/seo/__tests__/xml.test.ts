import { element, xmlResponse } from '../xml';

describe('apps/client/web: xml', () => {
  it('wraps text in an element, escaping the five characters XML reserves', () => {
    expect(element('t', `<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '<t>&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;</t>'
    );
  });

  it('answers a document with its declaration, content type and a short cache', async () => {
    const response = xmlResponse('<a/>', 'application/xml');

    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(await response.text()).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<a/>');
  });
});
