// bun test reads no vitest config: this is its `restoreMocks: true`.
afterEach(() => {
  vi.restoreAllMocks();
});
