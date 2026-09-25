import { withLivePage } from './live-page';

vi.mock(import('react'), async (importOriginal) => withLivePage(await importOriginal()));
