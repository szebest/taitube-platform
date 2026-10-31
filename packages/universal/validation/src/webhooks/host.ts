const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const INTERNAL_SUFFIXES = [
  '.localhost',
  '.local',
  '.localdomain',
  '.internal',
  '.lan',
  '.home.arpa',
];

function ipv4Octets(text: string): number[] | null {
  const match = IPV4.exec(text);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

function isPrivateIpv4([a = 0, b = 0, c = 0]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** Eight 16-bit groups, or `null` when the text is not an IPv6 address. */
function ipv6Groups(text: string): number[] | null {
  const [address = '', zone] = text.split('%');
  if (zone === '' || !address.includes(':')) return null;

  const tail = address.slice(address.lastIndexOf(':') + 1);
  const embedded = ipv4Octets(tail);
  const hex = embedded
    ? `${address.slice(0, address.length - tail.length)}${(
        (embedded[0] ?? 0) * 256 + (embedded[1] ?? 0)
      ).toString(16)}:${((embedded[2] ?? 0) * 256 + (embedded[3] ?? 0)).toString(16)}`
    : address;

  const halves = hex.split('::');
  if (halves.length > 2) return null;
  const parse = (half: string) => (half === '' ? [] : half.split(':'));
  const head = parse(halves[0] ?? '');
  const rest = parse(halves[1] ?? '');
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  const numbers = groups.map((group) =>
    /^[0-9a-f]{1,4}$/i.test(group) ? parseInt(group, 16) : NaN
  );
  return numbers.some(Number.isNaN) ? null : numbers;
}

function isPrivateIpv6(groups: number[]): boolean {
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
  const embeddedV4 = [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff];

  if (groups.slice(0, 6).every((group) => group === 0)) return true;
  if (groups.slice(0, 5).every((group) => group === 0) && g5 === 0xffff) {
    return isPrivateIpv4(embeddedV4);
  }
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isPrivateIpv4(embeddedV4);
  }
  return (g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80 || (g0 & 0xff00) === 0xff00;
}

/**
 * Whether a host names this machine or a private network: loopback, link-local, unique-local,
 * carrier-grade NAT and multicast addresses, `localhost`, internal suffixes, and any single-label
 * name, which only resolves inside a cluster or a LAN. Takes a URL hostname (an IPv6 literal in
 * brackets) or an address a resolver returned.
 */
export function isPrivateHost(host: string): boolean {
  const name = host
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');

  const v4 = ipv4Octets(name);
  if (v4) return isPrivateIpv4(v4);

  const v6 = ipv6Groups(name);
  if (v6) return isPrivateIpv6(v6);

  return (
    name === 'localhost' || !name.includes('.') || INTERNAL_SUFFIXES.some((s) => name.endsWith(s))
  );
}
