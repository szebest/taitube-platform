// An app spec renders the app, not its telemetry: started, it would load the OpenTelemetry SDK into
// every isolated jsdom file. The package's own specs and the Playwright flows cover it.
vi.mock(import('./use-web-telemetry'), () => ({ useWebTelemetry: () => undefined }));
