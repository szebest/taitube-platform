import { toOutboxRecord } from '../outbox.mapper';

const RECORD = {
  id: 'obx-1',
  kind: 'queue',
  payload: { type: 'queue', queueName: 'probe', job: { name: 'probe', data: {} } },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  publishedAt: null,
  attempts: 0,
  status: 'PENDING',
} as const;

describe('adapters/postgres/mappers: outbox', () => {
  it('carries the row through without its claim lease', () => {
    const record = toOutboxRecord({ ...RECORD, claimableAt: new Date('2026-01-01T00:01:00Z') });

    expect(record).toEqual(RECORD);
  });
});
