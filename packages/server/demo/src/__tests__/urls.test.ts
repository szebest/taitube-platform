import { CREDENTIAL_FALLBACKS, endpoints } from '../urls';
import { optionsFrom } from './fake-host';

const labels = (argv: string[]) =>
  endpoints(optionsFrom(argv), CREDENTIAL_FALLBACKS).map((e) => e.label);

describe('demo: urls', () => {
  it.each([
    { argv: [], labels: ['Web', 'Studio', 'API', 'API docs', 'Bull Board', 'MinIO'] },
    { argv: ['--only', 'web'], labels: ['Web', 'API', 'API docs', 'Bull Board', 'MinIO'] },
    { argv: ['--only', 'web', '--no-worker'], labels: ['Web', 'MinIO'] },
    {
      argv: ['--observability'],
      labels: ['Web', 'Studio', 'API', 'API docs', 'Bull Board', 'MinIO', 'Grafana'],
    },
    {
      argv: ['--profile', 'full'],
      labels: ['Web', 'Studio', 'API', 'API docs', 'Bull Board', 'MinIO', 'Live RTMP', 'Live WHIP'],
    },
  ])('lists $labels for $argv', ({ argv, labels: expected }) => {
    expect(labels(argv)).toEqual(expected);
  });

  it('points the API rows at the API url and shows the credentials', () => {
    const rows = endpoints(optionsFrom(['--api-url', 'http://localhost:4000']), {
      adminToken: 'tok',
      storageUser: 'u',
      storagePassword: 'p',
    });
    expect(rows.find((r) => r.label === 'Bull Board')).toMatchObject({
      url: 'http://localhost:4000/admin/queues',
      note: 'header x-admin-token: tok',
    });
    expect(rows.find((r) => r.label === 'MinIO')?.note).toBe('u / p');
  });
});
