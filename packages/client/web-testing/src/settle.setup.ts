import { cleanup } from '@testing-library/react';
import {
  endUpdates,
  settle,
  startUpdates,
  trackQueryClients,
  trapLeakedUpdates,
} from './test-settle';

// The last setup file, so its afterEach runs first: the test settles and unmounts before the API
// server drops its handlers. Testing Library's own cleanup is off (RTL_SKIP_AUTO_CLEANUP), since it
// would unmount before anything here could wait.
trackQueryClients();
trapLeakedUpdates();

beforeEach(startUpdates);

afterEach(async ({ task }) => {
  vi.useRealTimers();
  try {
    await settle();
  } finally {
    cleanup();
    // Video.js destroys an unmounted player on a 0 ms timer, which sets state; it runs here, first in line.
    await new Promise((resolve) => setTimeout(resolve, 0));
    endUpdates(task.fullName);
  }
});
