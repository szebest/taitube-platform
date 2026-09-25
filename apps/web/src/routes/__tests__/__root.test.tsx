import { recordRequests } from '#app/__tests__/api-store';
import { serverRender } from '#app/__tests__/server-render';

async function home(): Promise<string> {
  recordRequests();
  return (await serverRender('/')).html;
}

describe('apps/web: root route', () => {
  it('renders the whole document, so no static HTML shell is needed', async () => {
    const html = await home();

    expect(html.startsWith('<!DOCTYPE html><html lang="en"><head>')).toBe(true);
    expect(html).toContain('<title>Taitube</title>');
    expect(html).toContain('<meta name="description" content="Share videos with others online!"/>');
  });

  it('links the global stylesheets from the document head, before the page paints', async () => {
    const head = (await home()).split('</head>')[0] ?? '';

    expect(head.match(/<link rel="stylesheet"/g)).toHaveLength(3);
  });

  it('frames every page in the legacy layout', async () => {
    const html = await home();

    expect(html).toContain('aria-label="toggle sidebar"');
    expect(html).toContain('href="/trending"');
  });
});
