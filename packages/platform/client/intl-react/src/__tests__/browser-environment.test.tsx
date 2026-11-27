import { readBrowserEnvironment } from '../browser-environment';

describe('@kit/intl-react: readBrowserEnvironment', () => {
  it("reads the runtime's zone and the time from the clock it is given", () => {
    const environment = readBrowserEnvironment({ now: () => Date.UTC(2026, 8, 22, 18, 30) });

    expect(environment.timeZone).not.toBe('');
    expect(environment.now).toBe('2026-09-22T18:30:00.000Z');
  });
});
