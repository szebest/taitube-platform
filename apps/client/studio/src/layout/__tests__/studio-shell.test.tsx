import { renderPage, signIn, stubSession } from '#app/__tests__/render-page';
import { StudioShell } from '../studio-shell';

describe('apps/client/studio: shell', () => {
  it('frames every page with the logo, the theme menu and the way back to the viewer app', async () => {
    stubSession();

    const markup = await renderPage(<StudioShell />);

    expect(markup).toContain('aria-label="Taitube"');
    expect(markup).toContain('Creator Studio');
    expect(markup).toContain('aria-label="Theme: Dark"');
    expect(markup).toContain('href="http://localhost:5173"');
    expect(markup).toContain('Back to Taitube');
  });

  it('names the signed-in creator', async () => {
    const queryClient = signIn();

    expect(await renderPage(<StudioShell />, { queryClient })).toContain('The Creator');
  });

  it('shows a guest no account', async () => {
    stubSession();

    expect(await renderPage(<StudioShell />)).not.toContain('The Creator');
  });
});
