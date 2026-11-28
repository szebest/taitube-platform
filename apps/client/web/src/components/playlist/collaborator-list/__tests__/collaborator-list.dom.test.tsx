import { axeViolations } from '@kit/web-testing/dom';
import { render, screen, within } from '@testing-library/react';
import { CollaboratorList } from '..';

const PEOPLE = [
  { id: 'ana', name: 'Ana Costa', meta: 'Owner', src: '/ana.jpg' },
  { id: 'bruno', name: 'Bruno Lima', meta: 'Joined 3 days ago', src: undefined },
];

const renderList = () =>
  render(
    <CollaboratorList.Root aria-label="Collaborators">
      {PEOPLE.map((person) => (
        <CollaboratorList.Item key={person.id}>
          <CollaboratorList.Avatar src={person.src} name={person.name} />
          <CollaboratorList.Name>{person.name}</CollaboratorList.Name>
          <CollaboratorList.Meta>{person.meta}</CollaboratorList.Meta>
          <CollaboratorList.Actions>
            <button type="button">Remove {person.name}</button>
          </CollaboratorList.Actions>
        </CollaboratorList.Item>
      ))}
    </CollaboratorList.Root>
  );

describe('apps/client/web: CollaboratorList', () => {
  it('is a labelled list with one item per person', () => {
    renderList();

    expect(screen.getByRole('list', { name: 'Collaborators' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(PEOPLE.length);
  });

  it.each(PEOPLE)('shows $name, $meta and the actions on one row', ({ name, meta }) => {
    renderList();

    const row = screen.getByText(name).closest('li') as HTMLElement;

    expect(within(row).getByText(meta)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: `Remove ${name}` })).toBeInTheDocument();
  });

  it('hides the avatar from assistive technology, the name being printed beside it', () => {
    const { container } = renderList();

    for (const avatar of container.querySelectorAll('[data-slot=collaborator-list-avatar]')) {
      expect(avatar).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderList();

    expect(await axeViolations()).toEqual([]);
  });
});
