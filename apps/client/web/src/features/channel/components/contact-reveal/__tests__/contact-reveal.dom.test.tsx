import { screen, within } from '@testing-library/react';
import { getChannel, revealChannelContact } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, CHANNEL_ID, channel, mockEndpoint, problemReply } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const renderContact = ({ signedIn }: { signedIn: boolean }) =>
  renderRoute(getRouter, `/channel/${CHANNEL_ID}`, {
    handlers: [
      mockEndpoint(getChannel, () => HttpResponse.json(channel({ hasContact: true }))),
      ...(signedIn ? [signInBrowser()] : []),
      ...loaderApi(),
    ],
  });

describe('apps/client/web: ContactReveal', () => {
  it('sends a guest to sign in instead of offering the address', async () => {
    await renderContact({ signedIn: false });

    const prompt = (await screen.findByText('Sign in to see the contact email')).parentElement;

    expect(prompt).not.toBeNull();
    expect(
      within(prompt as HTMLElement).getByRole('link', { name: 'Sign in' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show contact email' })).not.toBeInTheDocument();
  });

  it('shows the address as a mailto link once a signed-in viewer asks for it', async () => {
    apiServer.use(
      mockEndpoint(revealChannelContact, () => HttpResponse.json({ email: 'hello@example.com' }))
    );
    const { user } = await renderContact({ signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Show contact email' }));

    expect(await screen.findByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com'
    );
    expect(screen.queryByRole('button', { name: 'Show contact email' })).not.toBeInTheDocument();
  });

  it('toasts what the API refused with when the viewer is rate limited, and keeps the button', async () => {
    apiServer.use(mockEndpoint(revealChannelContact, () => problemReply(ErrorCodes.RATE_LIMITED)));
    const { user } = await renderContact({ signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Show contact email' }));

    expect(await screen.findByText('The contact email could not be shown')).toBeInTheDocument();
    expect(screen.getByText('Too many requests. Wait a moment and try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show contact email' })).toBeInTheDocument();
  });
});
