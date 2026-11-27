import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ActingChannel } from '@vp/domain';
import { seedVideo } from '../../__tests__/test-app';
import { checkLayout } from '../channel-layout-checks';
import { homeWith, section } from './channel-page-fixtures';

const OWNER = '00000000-0000-7000-8000-0000000000a1';
const OTHER = '00000000-0000-7000-8000-0000000000a2';
const MINE = '00000000-0000-7000-8000-000000000101';
const PRIVATE = '00000000-0000-7000-8000-000000000102';
const THEIRS = '00000000-0000-7000-8000-000000000103';

const picking = (id: string) =>
  homeWith(
    section('picks', { source: { type: 'picked', items: [{ kind: 'video', id }] }, sort: 'manual' })
  );

describe('checkLayout', () => {
  it('lets a layout through when what it picks is public and the channel own, and names what is not', async () => {
    const repositories = new InMemoryRepositories();
    const channel = expectOk(
      await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' })
    );
    await seedVideo(repositories, { id: MINE, ownerId: OWNER, channelId: channel.id });
    await seedVideo(repositories, {
      id: PRIVATE,
      ownerId: OWNER,
      channelId: channel.id,
      visibility: 'private',
    });
    await seedVideo(repositories, { id: THEIRS, ownerId: OTHER });
    const acting: ActingChannel = { channelId: channel.id, ownerId: OWNER, role: 'owner' };
    const deps = {
      layouts: repositories.channelLayouts,
      sources: repositories.channelPageSources,
      images: repositories.channelImages,
    };

    expectOk(await checkLayout(deps, acting, picking(MINE)));
    expect(expectErr(await checkLayout(deps, acting, picking(PRIVATE)))).toMatchObject({
      code: 'LAYOUT_REFERENCE_INVALID',
      id: PRIVATE,
    });
    expect(expectErr(await checkLayout(deps, acting, picking(THEIRS)))).toMatchObject({
      code: 'LAYOUT_REFERENCE_INVALID',
      id: THEIRS,
    });
  });
});
