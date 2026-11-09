import { render, screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { AuditLogList } from '../index';

function renderList(imageUrl: string | null = null) {
  return render(
    <AuditLogList.Root aria-label="Audit log entries">
      <AuditLogList.Item>
        <AuditLogList.Avatar name="Ada" imageUrl={imageUrl} />
        <AuditLogList.Body>
          <AuditLogList.Actor>Ada</AuditLogList.Actor>
          <AuditLogList.Action>Changed a role</AuditLogList.Action>
          <AuditLogList.Detail>from Editor to Manager</AuditLogList.Detail>
        </AuditLogList.Body>
        <AuditLogList.Time dateTime="2026-01-01T00:00:00.000Z">2 days ago</AuditLogList.Time>
      </AuditLogList.Item>
    </AuditLogList.Root>
  );
}

describe('apps/client/studio: AuditLogList', () => {
  it('lists each entry with its actor, action, detail and time', () => {
    renderList();

    const entry = within(screen.getByRole('list', { name: 'Audit log entries' })).getByRole(
      'listitem'
    );

    expect(entry).toHaveTextContent('AdaChanged a rolefrom Editor to Manager2 days ago');
    expect(within(entry).getByText('2 days ago')).toHaveAttribute(
      'datetime',
      '2026-01-01T00:00:00.000Z'
    );
  });

  it('stands the actor initial in for a picture that is missing, and says nothing for it', () => {
    renderList();

    expect(screen.getByText('A')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no accessibility violations', async () => {
    renderList();

    expect(await axeViolations()).toEqual([]);
  });
});
