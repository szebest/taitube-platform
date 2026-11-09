import { render, screen } from '@testing-library/react';
import { CHANNEL_ROLE_NAMES } from '@vp/domain';
import { axeViolations } from '@vp/web-testing/dom';
import { RoleBadge } from '../index';

describe('apps/client/studio: RoleBadge', () => {
  it.each(CHANNEL_ROLE_NAMES)('shows the %s role as the label it is given', (role) => {
    render(<RoleBadge channelRole={role}>{`Role ${role}`}</RoleBadge>);

    expect(screen.getByText(`Role ${role}`)).toHaveAttribute('data-role', role);
  });

  it('gives each role its own tone', () => {
    const { container } = render(
      <>
        {CHANNEL_ROLE_NAMES.map((role) => (
          <RoleBadge key={role} channelRole={role}>
            {role}
          </RoleBadge>
        ))}
      </>
    );

    const classes = [...container.querySelectorAll('[data-slot="badge"]')].map(
      (badge) => badge.className
    );

    expect(new Set(classes).size).toBe(CHANNEL_ROLE_NAMES.length);
  });

  it('has no accessibility violations', async () => {
    render(<RoleBadge channelRole="editor">Editor</RoleBadge>);

    expect(await axeViolations()).toEqual([]);
  });
});
