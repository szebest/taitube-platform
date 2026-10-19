import { IntlProvider } from '@vp/intl-react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LoginPage } from '../login-page';

function renderLogin(children?: ReactNode) {
  return renderToStaticMarkup(
    <IntlProvider locale="en" timeZone="UTC">
      <LoginPage>{children}</LoginPage>
    </IntlProvider>
  );
}

describe('@vp/queries: LoginPage', () => {
  it('offers the ways to sign in it is handed', () => {
    const markup = renderLogin(<button type="button">Creator</button>);

    expect(markup).toContain('Sign in</h1>');
    expect(markup).toContain('<button type="button">Creator</button>');
    expect(markup).not.toContain('No sign-in provider');
  });

  it('says so when this build offers none', () => {
    expect(renderLogin()).toContain('No sign-in provider is configured for this build.');
  });
});
