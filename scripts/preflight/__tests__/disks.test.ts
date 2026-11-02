import { availableBytes, type Disk, shortfalls } from '../disks';

const GIB = 1024 ** 3;

const COLIMA_DF = `Filesystem     1K-blocks     Used Available Use% Mounted on
/dev/vdb1       40971488 38545836    312220 100% /var/lib/docker`;

const disk = (overrides: Partial<Disk> = {}): Disk => ({
  label: 'the colima Docker disk',
  freeBytes: 6 * GIB,
  minimumGib: 5,
  fix: 'Free it with docker system prune -a.',
  ...overrides,
});

describe('preflight disks', () => {
  it('reads the available column of df -k, in bytes', () => {
    expect(availableBytes(COLIMA_DF)).toBe(312_220 * 1024);
  });

  it.each([
    { scenario: 'a disk above its threshold', freeBytes: 6 * GIB, expected: [] },
    {
      scenario: 'the measured full colima disk',
      freeBytes: availableBytes(COLIMA_DF),
      expected: [
        'the colima Docker disk: 0.3 GiB free, below 5 GiB. Free it with docker system prune -a.',
      ],
    },
  ])('reports $scenario', ({ freeBytes, expected }) => {
    expect(shortfalls([disk({ freeBytes })])).toEqual(expected);
  });
});
