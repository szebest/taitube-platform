import { assignWatchPartyRole, createWatchPartyRole } from '../watch-party-roles';

describe('packages/api-contracts: watch party roles', () => {
  it.each([
    {
      scenario: 'a role with known permissions',
      body: { name: 'Organizer', permissions: ['roles.assign'] },
      ok: true,
    },
    {
      scenario: 'a restrict role with a colour',
      body: { name: 'Quiet', kind: 'restrict', colour: '#334455', permissions: [] },
      ok: true,
    },
    {
      scenario: 'a permission outside the registry',
      body: { name: 'Odd', permissions: ['room.lights'] },
      ok: false,
    },
    {
      scenario: 'a colour that is no hex',
      body: { name: 'Odd', colour: 'blue', permissions: [] },
      ok: false,
    },
  ])('takes $scenario: $ok', ({ body, ok }) => {
    expect(createWatchPartyRole.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    { expiresIn: '10m', ok: true },
    { expiresIn: 'party', ok: true },
    { expiresIn: '2h', ok: false },
  ])('takes a mute for $expiresIn: $ok', ({ expiresIn, ok }) => {
    expect(assignWatchPartyRole.body.safeParse({ expiresIn }).success).toBe(ok);
  });
});
