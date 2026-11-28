import { Counter, type Registry } from 'prom-client';

/** @public */
export interface MetricsRegistrySubject {
  readonly registry: Registry;
  readonly prefix: string;
}

/** @public */
export type MakeMetricsRegistry = () => MetricsRegistrySubject;

const PROCESS_METRIC = 'process_cpu_seconds_total';
const PROBE = 'contract_probe_total';

const namesOf = async ({ registry }: MetricsRegistrySubject): Promise<string[]> =>
  (await registry.getMetricsAsJSON()).map(({ name }) => name);

/** @public */
export function describeMetricsRegistryContract(makeSubject: MakeMetricsRegistry): void {
  describe('Metrics registry contract', () => {
    let subject: MetricsRegistrySubject;

    beforeEach(() => {
      subject = makeSubject();
    });

    it('exposes the default process metrics under its prefix, and under no other name', async () => {
      const names = await namesOf(subject);

      expect(names).toContain(`${subject.prefix}${PROCESS_METRIC}`);
      expect(names).not.toContain(PROCESS_METRIC);
    });

    it('exposes a metric registered on it, with the help text it was given', async () => {
      const probe = new Counter({
        name: PROBE,
        help: 'contract probe',
        registers: [subject.registry],
      });
      probe.inc();

      expect(await subject.registry.metrics()).toContain(`# HELP ${PROBE} contract probe`);
    });

    it('rejects a second metric under a name it already holds', () => {
      const register = () =>
        new Counter({ name: PROBE, help: 'probe', registers: [subject.registry] });
      register();

      expect(register).toThrow(PROBE);
    });

    it('is its own, so a metric registered on one is not on the next the app builds', async () => {
      new Counter({ name: PROBE, help: 'probe', registers: [subject.registry] });
      const other = makeSubject();

      expect(await namesOf(other)).not.toContain(PROBE);
      expect(other.registry).not.toBe(subject.registry);
    });
  });
}
