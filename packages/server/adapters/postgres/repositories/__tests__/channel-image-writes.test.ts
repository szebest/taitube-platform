import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import {
  commitUpload,
  failUpload,
  lockUpload,
  nextVersion,
  toChannelImageUpload,
} from '../channel-image-writes';

const OWNER_ID = '00000000-0000-7000-8000-0000000000a1';
const CHANNEL_ID = '00000000-0000-7000-8000-0000000000c1';
const CROP = { x: 0, y: 0, width: 400, height: 400 };
const URL = 'https://cdn.example/avatar-128.webp';
const uploadId = (n: number) => `00000000-0000-7000-8000-0000000000e${n}`;

function expectRow<T>(row: T | null): T {
  if (row === null) throw new Error('expected an upload row');
  return row;
}

describe('postgres: channel image writes', () => {
  async function seeded() {
    const engine = await migratedPglite();
    const db = drizzle(engine, { schema });
    await db.insert(schema.users).values({ id: OWNER_ID, email: 'owner@test.local' });
    await db
      .insert(schema.channels)
      .values({ id: CHANNEL_ID, userId: OWNER_ID, handle: 'owner', displayName: 'Owner' });
    await db.insert(schema.channelImageUploads).values(
      [1, 2].map((n) => ({
        id: uploadId(n),
        channelId: CHANNEL_ID,
        uploadedBy: OWNER_ID,
        kind: 'avatar' as const,
        contentType: 'image/png',
        sizeBytes: 100,
        status: 'queued' as const,
        crops: { kind: 'avatar' as const, crop: CROP },
        version: n,
      }))
    );
    return { engine, db };
  }

  it('numbers the next version after the newest queued or taken', async () => {
    const { engine, db } = await seeded();
    try {
      expect(await nextVersion(db, { channelId: CHANNEL_ID, kind: 'avatar' })).toBe(3);
      expect(await nextVersion(db, { channelId: CHANNEL_ID, kind: 'banner' })).toBe(1);
    } finally {
      await engine.close();
    }
  });

  it('finds an upload to lock, and none for an unknown id', async () => {
    const { engine, db } = await seeded();
    try {
      expect(await lockUpload(db, uploadId(1))).toMatchObject({ id: uploadId(1) });
      expect(await lockUpload(db, uploadId(9))).toBeNull();
    } finally {
      await engine.close();
    }
  });

  it('takes a newer version, refuses an older one and appends one audit row and one event', async () => {
    const { engine, db } = await seeded();
    try {
      const newer = expectRow(await lockUpload(db, uploadId(2)));
      const older = expectRow(await lockUpload(db, uploadId(1)));

      expect((await commitUpload(db, newer, URL)).applied).toBe(true);
      expect((await commitUpload(db, older, URL)).applied).toBe(false);

      expect(await db.select().from(schema.channelAuditLog)).toHaveLength(1);
      expect(await db.select().from(schema.userEvents)).toHaveLength(1);
      const [channel] = await db.select().from(schema.channels);
      expect(channel).toMatchObject({ avatarVersion: 2, avatarUrl: URL });
    } finally {
      await engine.close();
    }
  });

  it('fails an upload with its reason and tells its uploader', async () => {
    const { engine, db } = await seeded();
    try {
      const row = expectRow(await lockUpload(db, uploadId(1)));

      const failed = await failUpload(db, row, 'unreadable');

      expect(failed).toMatchObject({ status: 'failed', failure: 'unreadable' });
      expect(await db.select().from(schema.userEvents)).toHaveLength(1);
    } finally {
      await engine.close();
    }
  });

  it('reads a row as the entity', () => {
    const row = { id: uploadId(1) } as Parameters<typeof toChannelImageUpload>[0];
    expect(toChannelImageUpload(row)).toBe(row);
  });
});
