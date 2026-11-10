import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { consumeBudget, rateLimited } from '../watch-party-budgets';
import { watchPartyTestDeps } from './watch-party-test-deps';

const RULE = { limit: 2, windowSeconds: 60 };

describe('apps/server/api/services: consumeBudget', () => {
  it('admits up to the limit, then refuses with the wait left in the window', async () => {
    const { gate, clock } = watchPartyTestDeps();
    expectOk(await consumeBudget(gate, 'create', 'user-1', RULE));
    expectOk(await consumeBudget(gate, 'create', 'user-1', RULE));
    clock.advance(10_000);

    expect(expectErr(await consumeBudget(gate, 'create', 'user-1', RULE))).toEqual(rateLimited(50));
  });

  it.each([
    { scenario: 'another scope', budget: 'create' as const, scope: 'user-2' },
    { scenario: 'another budget', budget: 'invite' as const, scope: 'user-1' },
  ])('counts $scenario on its own', async ({ budget, scope }) => {
    const { gate } = watchPartyTestDeps();
    expectOk(await consumeBudget(gate, 'create', 'user-1', RULE));
    expectOk(await consumeBudget(gate, 'create', 'user-1', RULE));

    expectOk(await consumeBudget(gate, budget, scope, RULE));
  });

  it('is a rate limit failure carrying how long to wait', () => {
    expect(rateLimited(7)).toMatchObject({ code: ErrorCodes.RATE_LIMITED, retryAfterSeconds: 7 });
  });
});
