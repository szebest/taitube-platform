import { publicResponsesOnly } from '../public-response-plugin';

async function admit(init: ResponseInit) {
  const response = new Response('{}', init);
  return (await publicResponsesOnly({ response })) === response;
}

describe('apps/client/web: publicResponsesOnly', () => {
  it.each([
    { control: 'public, max-age=60', status: 200, expected: true },
    { control: 'public, max-age=60, stale-while-revalidate=30', status: 200, expected: true },
    { control: 'private, max-age=60', status: 200, expected: false },
    { control: 'public, no-store', status: 200, expected: false },
    { control: 'private', status: 200, expected: false },
    { control: '', status: 200, expected: false },
    { control: 'public, max-age=60', status: 206, expected: false },
    { control: 'public, max-age=60', status: 500, expected: false },
  ])(
    'a $status answered with "$control" is stored: $expected',
    async ({ control, status, expected }) => {
      const headers = control ? { 'cache-control': control } : undefined;

      expect(await admit({ status, headers })).toBe(expected);
    }
  );
});
