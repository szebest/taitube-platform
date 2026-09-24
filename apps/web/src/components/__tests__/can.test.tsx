import { renderToStaticMarkup } from 'react-dom/server';
import { canCreateVideo, type UserContext } from '@vp/permissions';
import { PermissionsProvider } from '../../modules/shared/providers/permissions-provider';
import { Can, type CanProps } from '../can';

type Props = CanProps<{ user: UserContext | null }>;
type Gate = Props extends infer G ? (G extends Props ? Omit<G, 'children' | 'fallback'> : never) : never;

const USER: UserContext = { id: 'usr-1', role: 'USER' };

describe('Can Slot Component', () => {
  it.each<{ scenario: string; user: UserContext | null; gate: Gate; shown: string; hidden: string }>([
    {
      scenario: 'children when a guest may read via an ability',
      user: null,
      gate: { type: 'ability', do: 'read', on: 'Video' },
      shown: 'ALLOWED',
      hidden: 'DENIED',
    },
    {
      scenario: 'the fallback when a guest may not create via an ability',
      user: null,
      gate: { type: 'ability', do: 'create', on: 'Video' },
      shown: 'DENIED',
      hidden: 'ALLOWED',
    },
    {
      scenario: 'the fallback when a guest fails a rule',
      user: null,
      gate: { type: 'rule', I: canCreateVideo, this: {} },
      shown: 'DENIED',
      hidden: 'ALLOWED',
    },
    {
      scenario: 'children when an authenticated user passes a rule',
      user: USER,
      gate: { type: 'rule', I: canCreateVideo, this: {} },
      shown: 'ALLOWED',
      hidden: 'DENIED',
    },
  ])('renders $scenario', ({ user, gate, shown, hidden }) => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={user}>
        <Can {...gate} fallback={<span>DENIED</span>}>
          <span>ALLOWED</span>
        </Can>
      </PermissionsProvider>
    );

    expect(html).toContain(shown);
    expect(html).not.toContain(hidden);
  });
});
