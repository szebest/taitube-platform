import { renderToStaticMarkup } from 'react-dom/server';
import { canCreateVideo } from '@vp/permissions';
import { PermissionsProvider } from '../../modules/shared/providers/permissions-provider';
import { Can } from '../can';

describe('Can Slot Component', () => {
  it('renders children when allowed via do/on for guest', () => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={null}>
        <Can do="read" on="Video" fallback={<span>DENIED</span>}>
          <span>ALLOWED</span>
        </Can>
      </PermissionsProvider>
    );

    expect(html).toContain('ALLOWED');
    expect(html).not.toContain('DENIED');
  });

  it('renders fallback when denied via helper I/this for guest', () => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={null}>
        <Can I={canCreateVideo} this={{}} fallback={<span>DENIED</span>}>
          <span>ALLOWED</span>
        </Can>
      </PermissionsProvider>
    );

    expect(html).toContain('DENIED');
    expect(html).not.toContain('ALLOWED');
  });

  it('renders fallback when denied via do/on for guest', () => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={null}>
        <Can do="create" on="Video" fallback={<span>DENIED</span>}>
          <span>ALLOWED</span>
        </Can>
      </PermissionsProvider>
    );

    expect(html).toContain('DENIED');
    expect(html).not.toContain('ALLOWED');
  });

  it('renders children when authenticated user has permission', () => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={{ id: 'usr-1', role: 'USER' }}>
        <Can I={canCreateVideo} this={{}} fallback={<span>DENIED</span>}>
          <span>ALLOWED</span>
        </Can>
      </PermissionsProvider>
    );

    expect(html).toContain('ALLOWED');
    expect(html).not.toContain('DENIED');
  });
});
