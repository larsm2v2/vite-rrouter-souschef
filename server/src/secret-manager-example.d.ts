declare module "../secret-manager-example" {
  export function startupCache(): Promise<void>;
  export function scheduleRefresh(intervalMs?: number): void;
}
