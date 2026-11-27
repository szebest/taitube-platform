import { getSyncBadge } from '../get-sync-badge';

describe('apps/client/web: getSyncBadge', () => {
  it.each([
    { connected: true, catchingUp: false, copy: 'party.stageSyncing', tone: 'neutral' },
    { connected: true, catchingUp: true, copy: 'party.stageCatchingUp', tone: 'warning' },
    { connected: false, catchingUp: false, copy: 'party.stageReconnecting', tone: 'warning' },
    { connected: false, catchingUp: true, copy: 'party.stageReconnecting', tone: 'warning' },
  ])(
    'is $copy when connected is $connected and catching up is $catchingUp',
    ({ connected, catchingUp, copy, tone }) => {
      expect(getSyncBadge(connected, catchingUp)).toEqual({ copy, tone });
    }
  );
});
