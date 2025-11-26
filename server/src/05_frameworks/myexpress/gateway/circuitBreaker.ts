// Simple circuit breaker implementation (can replace with opossum later)
// Tracks failures and opens circuit to prevent cascade failures

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: "closed" | "open" | "half-open";
}

const circuits = new Map<string, CircuitState>();

const FAILURE_THRESHOLD = 5; // Open circuit after 5 failures
const TIMEOUT_MS = 15000; // Keep circuit open for 15 seconds (tolerance for cold starts)
const HALF_OPEN_ATTEMPTS = 1; // Allow 1 attempt in half-open state

export class CircuitBreakerError extends Error {
  constructor(serviceName: string) {
    super(`Circuit breaker open for ${serviceName}`);
    this.name = "CircuitBreakerError";
  }
}

function getCircuit(serviceName: string): CircuitState {
  if (!circuits.has(serviceName)) {
    circuits.set(serviceName, {
      failures: 0,
      lastFailureTime: 0,
      state: "closed",
    });
  }
  return circuits.get(serviceName)!;
}

function updateCircuitState(circuit: CircuitState): void {
  const now = Date.now();
  const timeSinceLastFailure = now - circuit.lastFailureTime;

  if (circuit.state === "open" && timeSinceLastFailure > TIMEOUT_MS) {
    // Transition to half-open after timeout
    circuit.state = "half-open";
    console.log("Circuit breaker transitioning to half-open state");
  }
}

export function recordSuccess(serviceName: string): void {
  const circuit = getCircuit(serviceName);
  circuit.failures = 0;
  circuit.state = "closed";
}

export function recordFailure(serviceName: string): void {
  const circuit = getCircuit(serviceName);
  circuit.failures++;
  circuit.lastFailureTime = Date.now();

  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = "open";
    console.error(
      `Circuit breaker opened for ${serviceName} after ${circuit.failures} failures`
    );
  }
}

export function checkCircuit(serviceName: string): void {
  const circuit = getCircuit(serviceName);
  updateCircuitState(circuit);

  if (circuit.state === "open") {
    throw new CircuitBreakerError(serviceName);
  }
}

// Wrapper function for calling external services with circuit breaker
export async function callWithCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>
): Promise<T> {
  checkCircuit(serviceName);

  try {
    const result = await fn();
    recordSuccess(serviceName);
    return result;
  } catch (error) {
    recordFailure(serviceName);
    throw error;
  }
}
