export interface HealthCheckable {
  checkHealth(): Promise<boolean>;
}
