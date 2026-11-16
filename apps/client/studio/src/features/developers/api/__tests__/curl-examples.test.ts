import { API_SCOPES } from '@vp/domain';
import { curlExamples } from '../curl-examples';

const BASE = 'http://localhost:3000';
const examples = curlExamples(BASE);
const commandFor = (scope: string) => examples.find((example) => example.scope === scope)?.command;

describe('apps/client/studio: curlExamples', () => {
  it('gives every scope one example on a route that names that scope', () => {
    expect(examples.map(({ scope }) => scope)).toEqual([...API_SCOPES]);
    expect(examples.every(({ scope, endpoint }) => endpoint.scope === scope)).toBe(true);
  });

  it.each([
    {
      scope: 'analytics:read',
      command: `curl "${BASE}/v1/creator/channel/analytics" \\\n  -H "Authorization: Bearer $TAITUBE_TOKEN"`,
    },
    {
      scope: 'exports:create',
      command: `curl -X POST "${BASE}/v1/me/channel/exports" \\\n  -H "Authorization: Bearer $TAITUBE_TOKEN" \\\n  --json '{"kind":"video_analytics","format":"csv"}'`,
    },
    {
      scope: 'comments:read',
      command: `curl "${BASE}/v1/comments/<id>/replies" \\\n  -H "Authorization: Bearer $TAITUBE_TOKEN"`,
    },
  ])('writes $scope as a read that runs as pasted where one exists', ({ scope, command }) => {
    expect(commandFor(scope)).toBe(command);
  });
});
