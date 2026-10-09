import type { UserContext } from '@vp/permissions';
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

const GUEST_ABILITY = ['ROLE:NONE', 'READ_VIDEO:YES', 'CANNOT_MANAGE_ALL:YES', 'MANAGE_ALL:NO'];

describe('PermissionsProvider', () => {
  it.each([
    {
      scenario: 'guest permissions for a null userContext',
      userContext: null,
      expected: GUEST_ABILITY,
    },
    {
      scenario: 'the admin superuser ability for an admin',
      userContext: { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' } as UserContext,
      expected: ['ROLE:ADMIN', 'READ_VIDEO:YES', 'CANNOT_MANAGE_ALL:NO', 'MANAGE_ALL:YES'],
    },
  ])('provides $scenario', ({ userContext, expected }) => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={userContext}>
        <TestConsumer />
      </PermissionsProvider>
    );

    for (const fragment of expected) expect(html).toContain(fragment);
  });

  it('falls back to guest permissions when neither a userContext nor an AuthProvider is given', () => {
    const html = renderToStaticMarkup(
      <PermissionsProvider>
        <TestConsumer />
      </PermissionsProvider>
    );

    for (const fragment of GUEST_ABILITY) expect(html).toContain(fragment);
  });

  it('throws error when usePermissions is invoked outside PermissionsProvider', () => {
    expect(() => {
      renderToStaticMarkup(<TestConsumer />);
    }).toThrow('usePermissions must be used within PermissionsProvider');
  });
});
