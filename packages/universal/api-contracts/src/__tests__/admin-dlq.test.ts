import {
  DLQ_STATUSES,
  ListDlqQuerySchema,
  discardDlqEntry,
  listDlq,
  replayDlqEntry,
} from '../admin-dlq';

describe('packages/api-contracts: admin dlq', () => {
  it.each([
    [listDlq, 'GET', '/v1/admin/dlq', 200],
    [replayDlqEntry, 'POST', '/v1/admin/dlq/:id/replay', 202],
    [discardDlqEntry, 'DELETE', '/v1/admin/dlq/:id', 204],
  ])('declares %#: $method $path', (contract, method, path, status) => {
    expect(contract.method).toBe(method);
    expect(contract.path).toBe(path);
    expect(contract.status).toBe(status);
  });

  it.each(DLQ_STATUSES)('filters the list by status=%s', (status) => {
    expect(ListDlqQuerySchema.parse({ status }).status).toBe(status);
  });

  it('leaves the limit unset rather than defaulting it', () => {
    expect(ListDlqQuerySchema.parse({})).toEqual({});
    expect(ListDlqQuerySchema.safeParse({ status: 'PENDING' }).success).toBe(false);
  });

  it('guards every admin entry point with 401 and 403', () => {
    for (const contract of [listDlq, replayDlqEntry, discardDlqEntry]) {
      expect(contract.errors[401]).toContain('UNAUTHORIZED');
      expect(contract.errors[403]).toContain('FORBIDDEN');
    }
  });
});
