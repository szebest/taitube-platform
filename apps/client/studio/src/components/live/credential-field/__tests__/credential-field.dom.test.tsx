import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { CredentialField } from '../index';

const renderField = (secret: boolean, onCopy = vi.fn()) => {
  render(
    <CredentialField.Root secret={secret}>
      <CredentialField.Label>Stream key</CredentialField.Label>
      <CredentialField.Value>sk_live_123</CredentialField.Value>
      <CredentialField.Reveal showLabel="Reveal stream key" hideLabel="Hide stream key" />
      <CredentialField.Copy onClick={onCopy}>Copy stream key</CredentialField.Copy>
    </CredentialField.Root>
  );
  return { onCopy, user: userEvent.setup() };
};

describe('CredentialField', () => {
  it('masks a secret until it is revealed, and masks it again when hidden', async () => {
    const { user } = renderField(true);
    const field = screen.getByLabelText('Stream key');

    expect(field).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Reveal stream key' }));
    expect(field).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide stream key' }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('shows a plain value as it is, with nothing to reveal', () => {
    renderField(false);

    expect(screen.getByLabelText('Stream key')).toHaveAttribute('type', 'text');
    expect(screen.queryByRole('button', { name: 'Reveal stream key' })).toBeNull();
  });

  it('hands the click on Copy to its caller', async () => {
    const { user, onCopy } = renderField(true);

    await user.click(screen.getByRole('button', { name: 'Copy stream key' }));

    expect(onCopy).toHaveBeenCalledOnce();
  });

  it('passes axe', async () => {
    renderField(true);

    expect(await axeViolations()).toEqual([]);
  });
});
