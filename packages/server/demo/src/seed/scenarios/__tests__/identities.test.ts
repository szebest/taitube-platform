import { err } from '@vp/result';
import { createFakeApi } from '../../__tests__/fake-api';
import { createFakePorts } from '../../__tests__/fake-ports';
import { runScenariosOnFake } from '../../__tests__/fake-seed';
import { identities } from '../identities';

describe('seed/scenarios: identities', () => {
  it('upserts every user with the role and tier the world gives it', async () => {
    const { all, ports } = await runScenariosOnFake([], createFakeApi());

    expect(all[0]).toEqual({
      scenario: 'identities',
      status: 'done',
      detail: '8 users upserted with their roles',
    });
    expect(ports.identityRows[0]?.map((row) => row.role)).toEqual([
      'CREATOR',
      'USER',
      'ADMIN',
      'MODERATOR',
      'CREATOR',
      'CREATOR',
      'USER',
      'USER',
    ]);
  });

  it('fails, and so stops the run, when the database cannot be written', async () => {
    const api = createFakeApi();
    const ports = createFakePorts({ fetch: api.fetch });
    ports.writeIdentities = async () => err({ kind: 'database', message: 'no DATABASE_URL' });
    const lines: string[] = [];

    const outcome = await identities.run({ ports, world: { users: [] } } as never);
    lines.push(outcome.detail);

    expect(outcome).toEqual({ status: 'failed', detail: 'no DATABASE_URL' });
  });
});
