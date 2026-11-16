import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { SecretReveal } from '../index';

const SECRET = 'tt_pat_0a1b2c3d_9f8e7d6c5b4a';

const renderReveal = () => {
  const onCopy = vi.fn();
  const onDone = vi.fn();
  render(
    <AppProviders>
      <SecretReveal.Root value={SECRET}>
        <SecretReveal.Notice>You will not see this token again.</SecretReveal.Notice>
        <SecretReveal.Label>Your new token</SecretReveal.Label>
        <SecretReveal.Value />
        <SecretReveal.Copy onCopy={onCopy} />
        <SecretReveal.Acknowledge>I saved it somewhere safe</SecretReveal.Acknowledge>
        <SecretReveal.Done onClick={onDone}>Done</SecretReveal.Done>
      </SecretReveal.Root>
    </AppProviders>
  );
  return { onCopy, onDone, user: userEvent.setup() };
};

describe('SecretReveal', () => {
  it('shows the secret in full with the warning that it is shown once', () => {
    renderReveal();

    expect(screen.getByRole('textbox', { name: 'Your new token' })).toHaveValue(SECRET);
    expect(screen.getByRole('status')).toHaveTextContent('You will not see this token again.');
  });

  it('hands the secret to its caller on Copy and says it was copied', async () => {
    const { user, onCopy } = renderReveal();

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(onCopy).toHaveBeenCalledWith(SECRET);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('keeps Done disabled until the creator says the secret is saved', async () => {
    const { user, onDone } = renderReveal();
    const done = screen.getByRole('button', { name: 'Done' });

    expect(done).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'I saved it somewhere safe' }));
    await user.click(done);

    expect(onDone).toHaveBeenCalledOnce();
  });

  it('passes axe', async () => {
    renderReveal();

    expect(await axeViolations()).toEqual([]);
  });
});
