import { expectErr, expectOk } from '@vp/testing/result';
import { validateWebhookUrl } from '../url';

const PUBLIC = { allowPrivateHosts: false };
const LOCAL = { allowPrivateHosts: true };

describe('@vp/validation: validateWebhookUrl', () => {
  it('accepts an https URL on a public host and normalises it', () => {
    expect(expectOk(validateWebhookUrl('  https://Hooks.Example.com/in?x=1 ', PUBLIC))).toBe(
      'https://hooks.example.com/in?x=1'
    );
  });

  it.each([
    { scenario: 'empty', url: '', reason: 'malformed' },
    { scenario: 'not a URL', url: 'hooks.example.com/in', reason: 'malformed' },
    { scenario: 'too long', url: `https://example.com/${'a'.repeat(2048)}`, reason: 'malformed' },
    { scenario: 'plain http', url: 'http://hooks.example.com/in', reason: 'scheme' },
    { scenario: 'another scheme', url: 'ftp://hooks.example.com/in', reason: 'scheme' },
    { scenario: 'a user name', url: 'https://user@hooks.example.com/', reason: 'credentials' },
    { scenario: 'a password', url: 'https://:secret@hooks.example.com/', reason: 'credentials' },
    { scenario: 'loopback', url: 'https://127.0.0.1/in', reason: 'private-host' },
    { scenario: 'localhost', url: 'https://localhost:8443/in', reason: 'private-host' },
    {
      scenario: 'a metadata address',
      url: 'https://169.254.169.254/latest',
      reason: 'private-host',
    },
    { scenario: 'an IPv6 loopback', url: 'https://[::1]/in', reason: 'private-host' },
    { scenario: 'a decimal IPv4', url: 'https://2130706433/in', reason: 'private-host' },
    { scenario: 'a hex IPv4', url: 'https://0x7f.1/in', reason: 'private-host' },
    { scenario: 'a cluster name', url: 'https://redis:6379/', reason: 'private-host' },
  ])('refuses $scenario', ({ url, reason }) => {
    expect(expectErr(validateWebhookUrl(url, PUBLIC))).toMatchObject({
      field: 'url',
      reason,
    });
  });

  it.each(['http://localhost:9999/hook', 'https://10.0.0.5/hook', 'http://[::1]:3001/'])(
    'lets a deployment that allows private hosts reach %s',
    (url) => {
      expectOk(validateWebhookUrl(url, LOCAL));
    }
  );

  it('still refuses credentials and other schemes where private hosts are allowed', () => {
    expect(expectErr(validateWebhookUrl('http://u:p@localhost/', LOCAL))).toMatchObject({
      reason: 'credentials',
    });
    expect(expectErr(validateWebhookUrl('ftp://localhost/', LOCAL))).toMatchObject({
      reason: 'scheme',
    });
  });
});
