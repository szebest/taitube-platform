import { MemberKeySchema, WatchPartyPermissionSchema } from '../watch-party-resource';

describe('packages/api-contracts: watch party resources', () => {
  it.each([
    { value: 'user:0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', ok: true },
    { value: 'discord:80351110224678912', ok: true },
    { value: 'guest:g_4Hk9sPq2LmN8vR3t', ok: true },
    { value: 'admin:0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', ok: false },
    { value: 'user:', ok: false },
    { value: 'user:a/b', ok: false },
  ])('reads the member key $value: $ok', ({ value, ok }) => {
    expect(MemberKeySchema.safeParse(value).success).toBe(ok);
  });

  it.each([
    { value: 'chat.post', ok: true },
    { value: 'room.lights', ok: false },
  ])('reads the permission $value: $ok', ({ value, ok }) => {
    expect(WatchPartyPermissionSchema.safeParse(value).success).toBe(ok);
  });
});
