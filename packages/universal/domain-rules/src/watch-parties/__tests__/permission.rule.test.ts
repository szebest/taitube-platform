import { expectErr, expectOk } from '@vp/testing/result';
import { requireRoomPermission } from '../permission.rule';
import { seatOf } from './room-fixtures';

describe('@vp/domain-rules: requireRoomPermission', () => {
  it('passes a held permission', () => {
    expect(expectOk(requireRoomPermission(seatOf('dj').ability, 'queue.skip'))).toBe('queue.skip');
  });

  it('names the permission a member lacks', () => {
    expect(expectErr(requireRoomPermission(seatOf('member').ability, 'room.close'))).toMatchObject({
      permission: 'room.close',
    });
  });
});
