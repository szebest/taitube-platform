import { renderToStaticMarkup } from 'react-dom/server';
import { storeValue } from '../../../../__tests__/stored-value';
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
  it('opens the sidebar for a first visit', () => {
    expect(renderSidebar()).toContain('open');
  });

  it('keeps the sidebar collapsed when the viewer left it collapsed', () => {
    storeValue('SIDEBAR', true);

    expect(renderSidebar()).toContain('collapsed');
  });

  it('flips and remembers the sidebar on toggle', () => {
    const controls: SidebarControls = {};
    renderSidebar(controls);

    controls.toggle?.();

    expect(renderSidebar()).toContain('collapsed');
  });

  it('leaves a wide screen sidebar open when a link closes it', () => {
    const controls: SidebarControls = {};
    renderSidebar(controls);

    controls.close?.();

    expect(renderSidebar()).toContain('open');
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
