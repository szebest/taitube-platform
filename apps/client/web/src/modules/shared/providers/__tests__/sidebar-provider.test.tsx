import { renderToStaticMarkup } from 'react-dom/server';
import { stubBrowser } from '#app/__tests__/browser';
import { SidebarProvider, useSidebar } from '../sidebar-provider';

type SidebarControls = Partial<ReturnType<typeof useSidebar>>;

function renderSidebar(controls: SidebarControls = {}): string {
  function SidebarProbe() {
    const sidebar = useSidebar();
    Object.assign(controls, sidebar);
    return <span>{sidebar.collapsed ? 'collapsed' : 'open'}</span>;
  }

  return renderToStaticMarkup(
    <SidebarProvider>
      <SidebarProbe />
    </SidebarProvider>
  );
}

describe('apps/web: sidebar provider', () => {
  it('renders the sidebar open on the server, whatever the viewer left it as', () => {
    stubBrowser({ stored: { SIDEBAR: 'true' } });

    expect(renderSidebar()).toContain('open');
  });

  it('flips and remembers the sidebar on toggle', () => {
    const storage = stubBrowser();
    const controls: SidebarControls = {};
    renderSidebar(controls);

    controls.toggle?.();

    expect(storage.get('SIDEBAR')).toBe('true');
  });

  it('leaves a wide screen sidebar open when a link closes it', () => {
    const storage = stubBrowser();
    const controls: SidebarControls = {};
    renderSidebar(controls);

    controls.close?.();

    expect(storage.has('SIDEBAR')).toBe(false);
  });

  it('refuses useSidebar outside the provider', () => {
    function Orphan() {
      useSidebar();
      return null;
    }

    expect(() => renderToStaticMarkup(<Orphan />)).toThrow(
      'useSidebar must be used within SidebarProvider'
    );
  });
});
