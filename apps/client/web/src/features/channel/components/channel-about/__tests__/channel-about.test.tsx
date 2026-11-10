import { createToaster, ToastProvider } from '@vp/ui';
import { channel } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { ChannelAbout, type ChannelAboutProps } from '../channel-about';

const withToasts: typeof AppProviders = ({ children }) => (
  <AppProviders>
    <ToastProvider toaster={createToaster()}>{children}</ToastProvider>
  </AppProviders>
);

const renderAbout = (fields: Partial<ChannelAboutProps['channel']>) =>
  renderPage(<ChannelAbout channel={{ ...channel(), ...fields }} />, withToasts);

describe('apps/client/web: ChannelAbout', () => {
  it('renders nothing for a channel that lists no links, no country and no contact', async () => {
    expect(await renderAbout({})).not.toContain('>About</h2>');
  });

  it('lists each link with its platform mark, labelled, opening in a new tab', async () => {
    const markup = await renderAbout({
      links: [
        { label: 'Code', url: 'https://github.com/marta', platform: 'github' },
        { label: 'Site', url: 'https://marta.example', platform: 'website' },
      ],
    });

    expect(markup).toContain('>Links</dt>');
    expect(markup).toContain('href="https://github.com/marta"');
    expect(markup).toContain('data-platform="github"');
    expect(markup).toContain('>Site</a>');
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it('leaves out a link that is not https', async () => {
    const markup = await renderAbout({
      links: [{ label: 'Trap', url: 'javascript:alert(1)', platform: 'website' }],
    });

    expect(markup).not.toContain('>About</h2>');
  });

  it.each([
    { country: 'PL', name: 'Poland' },
    { country: 'PT', name: 'Portugal' },
  ])('names the country $country as the region $name', async ({ country, name }) => {
    expect(await renderAbout({ country })).toContain(`>${name}</dd>`);
  });

  it('shows the contact button to nobody but a channel that has an address', async () => {
    expect(await renderAbout({ hasContact: true })).toContain('>Contact</dt>');
    expect(await renderAbout({ hasContact: false, country: 'PL' })).not.toContain('>Contact</dt>');
  });
});
