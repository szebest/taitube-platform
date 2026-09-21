import { toOutboxRecord } from '../outbox.mapper';

describe('adapters/postgres/mappers: outbox', () => {
  it('carries the row through and types the jsonb payload', () => {
    const row = {
      id: 'obx-1',
      kind: 'queue',
      payload: { type: 'queue', queueName: 'probe', job: { name: 'probe', data: {} } },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      publishedAt: null,
      attempts: 0,
    };
    const record = toOutboxRecord(row as Parameters<typeof toOutboxRecord>[0]);
    expect(record).toEqual(row);
    expect(record.payload.type).toBe('queue');
  });
});
