import { requestHandler } from '@tanstack/react-start/server';

import { requestSidebarState, saveSidebarState } from '../sidebar-state';

async function stateFor(cookie: string): Promise<string> {
  const answer = requestHandler(async () => new Response(requestSidebarState()));
  const response = await answer(new Request('http://localhost:5173/', { headers: { cookie } }), {});
  return response.text();
}

describe('apps/client/web: sidebar state', () => {
  it.each([
    { cookie: 'vp.sidebar=collapsed', state: 'collapsed' },
    { cookie: 'vp.sidebar=expanded', state: 'expanded' },
    { cookie: '', state: 'expanded' },
    { cookie: 'vp.sidebar=wide', state: 'expanded' },
  ])('reads "$cookie" from the request as $state', async ({ cookie, state }) => {
    expect(await stateFor(cookie)).toBe(state);
  });

  it('keeps the state in a cookie for a year, so the next server render has it', () => {
    const document = { cookie: '' };
    vi.stubGlobal('document', document);

    saveSidebarState('collapsed');

    expect(document.cookie).toBe('vp.sidebar=collapsed; Max-Age=31536000; Path=/; SameSite=Lax');
  });
});
