import { expiredPreviews, expiresAt, previewSlug, resolveNamespace } from '../preview';

describe('previewSlug', () => {
  it.each([
    { ref: 'feat/Add_Player', slug: 'feat-add-player' },
    { ref: 'refs/heads/fix/Cache!!', slug: 'fix-cache' },
    { ref: 'refs/pull/326/merge', slug: '326-merge' },
    { ref: '///', slug: 'preview' },
    { ref: `${'a'.repeat(39)}-bbbb`, slug: 'a'.repeat(39) },
  ])('turns $ref into $slug', ({ ref, slug }) => {
    expect(previewSlug(ref)).toBe(slug);
  });
});

describe('resolveNamespace', () => {
  it.each([
    { pattern: 'video-pipeline', slug: undefined, expected: 'video-pipeline' },
    { pattern: 'preview-{slug}', slug: 'Feat/X', expected: 'preview-feat-x' },
    { pattern: 'preview-{slug}', slug: undefined, expected: undefined },
  ])('resolves $pattern for $slug', ({ pattern, slug, expected }) => {
    expect(resolveNamespace(pattern, slug)).toBe(expected);
  });
});

describe('expiry', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');

  it('adds the time to live', () => {
    expect(expiresAt(now, 24)).toBe('2026-11-11T12:00:00.000Z');
  });

  it('lists a preview whose expiry passed, or is missing or unreadable, and keeps the rest', () => {
    expect(
      expiredPreviews(
        [
          { name: 'preview-old', expiresAt: '2026-11-10T11:59:59.000Z' },
          { name: 'preview-new', expiresAt: '2026-11-10T12:00:01.000Z' },
          { name: 'preview-unlabelled', expiresAt: undefined },
          { name: 'preview-garbled', expiresAt: 'soon' },
        ],
        now
      )
    ).toEqual(['preview-garbled', 'preview-old', 'preview-unlabelled']);
  });
});
