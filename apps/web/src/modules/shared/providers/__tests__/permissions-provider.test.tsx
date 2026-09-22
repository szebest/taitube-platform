import { renderToStaticMarkup } from 'react-dom/server';
import { PermissionsProvider, usePermissions } from '../permissions-provider';

function TestConsumer() {
  const { can, cannot, userContext } = usePermissions();
  return (
    <div>
      <span>ROLE:{userContext?.role ?? 'NONE'}</span>
      <span>READ_VIDEO:{can('read', 'Video') ? 'YES' : 'NO'}</span>
      <span>CANNOT_MANAGE_ALL:{cannot('manage', 'all') ? 'YES' : 'NO'}</span>
      <span>MANAGE_ALL:{can('manage', 'all') ? 'YES' : 'NO'}</span>
    </div>
  );
}

describe('PermissionsProvider', () => {
  it('provides guest permissions when unauthenticated (null userContext)', () => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={null}>
        <TestConsumer />
      </PermissionsProvider>
    );

    expect(html).toContain('ROLE:NONE');
    expect(html).toContain('READ_VIDEO:YES');
    expect(html).toContain('CANNOT_MANAGE_ALL:YES');
    expect(html).toContain('MANAGE_ALL:NO');
  });

  it('provides admin superuser ability when authenticated as admin', () => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={{ id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' }}>
        <TestConsumer />
      </PermissionsProvider>
    );

    expect(html).toContain('ROLE:ADMIN');
    expect(html).toContain('READ_VIDEO:YES');
    expect(html).toContain('CANNOT_MANAGE_ALL:NO');
    expect(html).toContain('MANAGE_ALL:YES');
  });

  it('throws error when usePermissions is invoked outside PermissionsProvider', () => {
    expect(() => {
      renderToStaticMarkup(<TestConsumer />);
    }).toThrow('usePermissions must be used within PermissionsProvider');
  });
});
