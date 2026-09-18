import { isReservedHandle } from '@vp/core/domain';
import type { Repositories } from '@vp/core/ports';

export async function deriveUniqueHandle(
  repositories: Repositories,
  email: string,
  sub: string
): Promise<string> {
  const rawPrefix = email.split('@')[0] || sub.slice(0, 8);
  let base = rawPrefix.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
  if (base.length < 3) {
    base = `user_${base}`;
  }
  if (base.length > 25) {
    base = base.slice(0, 25);
  }
  if (isReservedHandle(base)) {
    base = `u_${base}`.slice(0, 30);
  }

  let candidate = base;
  let existing = await repositories.channels.findByHandle(candidate);
  if (!(existing || isReservedHandle(candidate))) {
    return candidate;
  }

  const cleanSub =
    sub
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toLowerCase() || '01';
  candidate = `${base.slice(0, 24)}_${cleanSub}`;
  existing = await repositories.channels.findByHandle(candidate);
  if (!(existing || isReservedHandle(candidate))) {
    return candidate;
  }

  let suffix = 1;
  while (true) {
    candidate = `${base.slice(0, 22)}_${cleanSub}${suffix}`;
    existing = await repositories.channels.findByHandle(candidate);
    if (!(existing || isReservedHandle(candidate))) {
      return candidate;
    }
    suffix++;
  }
}

export async function ensureUserAndChannelProvisioned(
  repositories: Repositories,
  sub: string,
  email?: string
): Promise<void> {
  const userEmail = email || `${sub}@taitube.local`;

  let user = await repositories.users.findById(sub);
  if (!user) {
    try {
      user = await repositories.users.upsert({
        id: sub,
        email: userEmail,
        tier: 'free',
      });
    } catch {
      user = await repositories.users.findById(sub);
    }
  }

  const channel = await repositories.channels.findByUserId(sub);
  if (!channel) {
    const handle = await deriveUniqueHandle(repositories, userEmail, sub);
    const displayName = email ? email.split('@')[0] || 'User' : 'User';
    try {
      await repositories.channels.create({
        userId: sub,
        handle,
        displayName,
      });
    } catch {
      // Handled in case of race conditions with concurrent requests
      await repositories.channels.findByUserId(sub);
    }
  }
}
