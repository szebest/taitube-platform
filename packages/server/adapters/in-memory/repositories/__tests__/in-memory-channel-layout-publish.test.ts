import { expectOk } from '@kit/testing/result';
import { standardChannelLayout } from '@vp/domain';
import { InMemoryChannelAuditRepository } from '../in-memory-channel-audit-repository';
import { publishChannelLayout } from '../in-memory-channel-layout-publish';
import { InMemoryEntityRevisionRepository } from '../in-memory-entity-revision-repository';

const CHANNEL = '00000000-0000-7000-8000-0000000000c1';
const USER = '00000000-0000-7000-8000-0000000000a1';
const NOW = new Date('2026-12-01T12:00:00.000Z');

describe('publishChannelLayout', () => {
  it('appends version after version and writes the audit entry for the version it made', async () => {
    const deps = {
      revisions: new InMemoryEntityRevisionRepository(),
      audit: new InMemoryChannelAuditRepository(),
    };
    const publish = async () =>
      expectOk(
        await publishChannelLayout(
          deps,
          {
            channelId: CHANNEL,
            document: standardChannelLayout(),
            authorUserId: USER,
            note: null,
            restoredFromVersion: null,
            audit: (version) => ({
              channelId: CHANNEL,
              actorUserId: USER,
              action: 'page.published',
              targetType: 'page',
              targetId: CHANNEL,
              meta: { version },
            }),
          },
          NOW
        )
      );

    expect([(await publish()).version, (await publish()).version]).toEqual([1, 2]);
    const entries = expectOk(await deps.audit.list(CHANNEL, { cursor: null, limit: 10 }));
    expect(entries.map(({ meta }) => meta)).toEqual([{ version: 2 }, { version: 1 }]);
  });
});
