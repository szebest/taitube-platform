import { measuredDisks } from '../preflight';

const df = (available: Record<string, number>) => (command: string) =>
  `Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/x 1 1 ${available[command] ?? 0} 1% /`;

describe('preflight', () => {
  it.each([
    { colima: false, labels: ['the disk holding this checkout'] },
    { colima: true, labels: ['the disk holding this checkout', 'the colima Docker disk'] },
  ])(
    'measures the host disk, and the colima disk when colima runs: $colima',
    ({ colima, labels }) => {
      const disks = measuredDisks(df({ df: 2048, colima: 1024 }), colima);

      expect(disks.map(({ label }) => label)).toEqual(labels);
      expect(disks.map(({ freeBytes }) => freeBytes)).toEqual(
        [2048 * 1024, 1024 * 1024].slice(0, labels.length)
      );
    }
  );
});
