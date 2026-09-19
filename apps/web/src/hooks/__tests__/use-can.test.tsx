import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { canCreateVideo } from '@vp/permissions';
import { PermissionsProvider } from '../../modules/shared/providers/permissions-provider';
import { useCan } from '../use-can';

function ActionConsumer() {
  const canRead = useCan('read', 'Video');
  const canManage = useCan('manage', 'all');
  const canCreate = useCan(canCreateVideo, {});

  return (
    <div>
      <span data-testid="can-read">{canRead ? 'READ_YES' : 'READ_NO'}</span>
      <span data-testid="can-manage">{canManage ? 'MANAGE_YES' : 'MANAGE_NO'}</span>
      <span data-testid="can-create">{canCreate ? 'CREATE_YES' : 'CREATE_NO'}</span>
    </div>
  );
}

describe('useCan', () => {
  it('evaluates CASL actions and helpers for guest', () => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={null}>
        <ActionConsumer />
      </PermissionsProvider>
    );

    expect(html).toContain('READ_YES');
    expect(html).toContain('MANAGE_NO');
    expect(html).toContain('CREATE_NO');
  });

  it('evaluates CASL actions and helpers for standard user', () => {
    const html = renderToStaticMarkup(
      <PermissionsProvider userContext={{ id: 'usr-1', role: 'USER' }}>
        <ActionConsumer />
      </PermissionsProvider>
    );

    expect(html).toContain('READ_YES');
    expect(html).toContain('MANAGE_NO');
    expect(html).toContain('CREATE_YES');
  });
});
