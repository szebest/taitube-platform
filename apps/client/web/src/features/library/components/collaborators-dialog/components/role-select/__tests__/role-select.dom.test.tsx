import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import type { PlaylistCollaboratorRole } from '@vp/domain';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import { RoleSelect } from '../role-select';

async function renderRoleSelect(value: PlaylistCollaboratorRole) {
  const onChange = vi.fn();
  const rendered = await renderPart(<RoleSelect value={value} onChange={onChange} />);
  return { ...rendered, onChange, trigger: screen.getByRole('combobox', { name: 'Role' }) };
}

describe('apps/client/web: the invite role select', () => {
  it('shows the role it holds and offers both roles', async () => {
    const { user, trigger } = await renderRoleSelect('contributor');

    expect(trigger).toHaveTextContent('Contributor');
    expect(await axeViolations()).toEqual([]);

    await user.click(trigger);

    expect(await screen.findAllByRole('option')).toHaveLength(2);
  });

  it.each([
    { picked: 'Editor', role: 'editor' },
    { picked: 'Contributor', role: 'contributor' },
  ])('hands back $role when $picked is picked', async ({ picked, role }) => {
    const { user, trigger, onChange } = await renderRoleSelect(
      role === 'editor' ? 'contributor' : 'editor'
    );

    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: picked }));

    expect(onChange).toHaveBeenCalledWith(role);
  });
});
