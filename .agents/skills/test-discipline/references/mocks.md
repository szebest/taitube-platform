# Mocks

Read before writing any mock. Stay as close to the real code as the setup allows; a test
that passes because its mock passes proves nothing.

## Before the mock: the real thing

In order of preference:

1. **The real dependency** when the setup can run it: an in-memory implementation of the
   port, a request-level network mock (MSW) instead of a mocked client, real providers,
   real children.
2. **A real session or fixture** for gated paths, instead of mocking the gate.
3. **A hook's or function's real return**, called for real.
4. Only then a module mock, on the leaf module, never a barrel. Mock only what is slow or
   external. If the mock setup is more than half the test, use the real thing.

Make at least one case assert presence: a suite of absences passes when the setup did
nothing.

## The shape of a mock

- **A plain mock function returning a static shape**: `vi.fn(() => ({ items: [] }))`,
  `vi.fn((key: string) => key)` for a translator. No effects, no branches, no state, no
  re-implementation of the real module. A mock grown an `if` so one assertion passes is
  the defect.
- **Assert the arguments the code under test computed**: the key and params it hands a
  translator, the payload it hands a sink, the derived value it hands a collaborator.
  A test whose only content is that a value given to the subject arrives unchanged at a
  child is pass-through, and owns nothing.
- **To check calls on a real function, spy, do not fake**: `vi.mock(import('./format'), {
  spy: true })` keeps the real implementation and records its calls.
- **Never rebuild a library in a mock** (no key-to-text map standing in for i18n, no
  hand-rolled template replacement): assert which key and which values, for the keys the
  code branches on.
- A mock mirrors the real data shape in full, never only the fields the test reads.

## Mechanics (Vitest)

1. **`vi.mock(import('<path>'), factory)`**, never a bare string path: the type checker
   then checks the path and the factory's shape, while a string goes inert on rename and
   the real module runs.
2. **A partial mock spreads a bare `importOriginal()`**:
   `vi.mock(import('./x'), async (importOriginal) => ({ ...(await importOriginal()), y: vi.fn() }))`.
   No type argument and no `typeof import(...)`: the `import()` argument already types it.
3. **Shared stubs, test ids and builders live beside the unit** in a mocks or fixtures
   module, not as consts at the top of each spec.
4. **Never re-mock a module the global setup already mocks**; read the setup file first
   and add a missing stub there.
5. A `vi.mock` factory is hoisted above the imports, so it cannot reference an imported
   value: inline it or use `vi.hoisted`.
6. **Navigation**: assert the router's resulting location over a mocked navigate function.
