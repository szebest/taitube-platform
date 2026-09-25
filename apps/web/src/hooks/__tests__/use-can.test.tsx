import { type UserContext, canReactVideo } from '@vp/permissions';
import { renderToStaticMarkup } from 'react-dom/server';
import { PermissionsProvider } from '#app/modules/shared/providers/permissions-provider';
import { useCan } from '../use-can';

function ActionConsumer() {
  const canRead = useCan('read', 'Video');
  const canManage = useCan('manage', 'all');
  const canReact = useCan(canReactVideo, {});

  return (
    <div>
      <span data-testid="can-read">{canRead ? 'READ_YES' : 'READ_NO'}</span>
      <span data-testid="can-manage">{canManage ? 'MANAGE_YES' : 'MANAGE_NO'}</span>
      <span data-testid="can-react">{canReact ? 'REACT_YES' : 'REACT_NO'}</span>
    </div>
  );
}

describe('useCan', () => {
  it.each<{ viewer: string; user: UserContext | null; expected: string[] }>([
    { viewer: 'a guest', user: null, expected: ['READ_YES', 'MANAGE_NO', 'REACT_NO'] },
    {
      viewer: 'a standard user',
      user: { id: 'usr-1', role: 'USER' },
      expected: ['READ_YES', 'MANAGE_NO', 'REACT_YES'],
    },
  ])('evaluates CASL actions and helpers for $viewer', ({ user, expected }) => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={user}>
        <ActionConsumer />
      </PermissionsProvider>
    );

    for (const verdict of expected) {
      expect(html).toContain(verdict);
    }
  });
});
