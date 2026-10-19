vi.mock(import('@tanstack/react-start'), async (importOriginal) => {
  const start = await importOriginal();
  const { inRenderedRequest } = await import('./server-functions');
  return { ...start, createServerFn: inRenderedRequest(start) };
});
