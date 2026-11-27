/** `{sha}` is the tag `images.yml` pushes for a commit: `sha-` and the full 40-character id. */
export function resolveTag(
  configured: string,
  override: string | undefined,
  headSha: string | undefined
): string | undefined {
  const wanted = override ?? configured;
  if (wanted !== '{sha}') return wanted;
  return headSha === undefined || headSha === '' ? undefined : `sha-${headSha}`;
}
