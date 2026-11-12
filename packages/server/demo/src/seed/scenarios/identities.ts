import { isErr } from '@vp/result';
import { describeFailure } from '../failure';
import type { Scenario } from '../scenario';

export const identities: Scenario = {
  name: 'identities',
  essential: true,
  needsReady: false,
  requires: [],
  async run({ world, ports }) {
    const written = await ports.writeIdentities(
      world.users.map(({ id, email, tier, role }) => ({ id, email, tier, role }))
    );
    if (isErr(written)) return { status: 'failed', detail: describeFailure(written.error) };
    return { status: 'done', detail: `${written.value} users upserted with their roles` };
  },
};
