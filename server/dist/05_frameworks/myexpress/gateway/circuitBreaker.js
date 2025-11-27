"use strict";
// Simple circuit breaker implementation (can replace with opossum later)
// Tracks failures and opens circuit to prevent cascade failures
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerError = void 0;
exports.recordSuccess = recordSuccess;
exports.recordFailure = recordFailure;
exports.checkCircuit = checkCircuit;
exports.callWithCircuitBreaker = callWithCircuitBreaker;
const circuits = new Map();
const FAILURE_THRESHOLD = 5; // Open circuit after 5 failures
const TIMEOUT_MS = 15000; // Keep circuit open for 15 seconds (tolerance for cold starts)
const HALF_OPEN_ATTEMPTS = 1; // Allow 1 attempt in half-open state
class CircuitBreakerError extends Error {
    constructor(serviceName) {
        super(`Circuit breaker open for ${serviceName}`);
        this.name = "CircuitBreakerError";
    }
}
exports.CircuitBreakerError = CircuitBreakerError;
function getCircuit(serviceName) {
    if (!circuits.has(serviceName)) {
        circuits.set(serviceName, {
            failures: 0,
            lastFailureTime: 0,
            state: "closed",
        });
    }
    return circuits.get(serviceName);
}
function updateCircuitState(circuit) {
    const now = Date.now();
    const timeSinceLastFailure = now - circuit.lastFailureTime;
    if (circuit.state === "open" && timeSinceLastFailure > TIMEOUT_MS) {
        // Transition to half-open after timeout
        circuit.state = "half-open";
        console.log("Circuit breaker transitioning to half-open state");
    }
}
function recordSuccess(serviceName) {
    const circuit = getCircuit(serviceName);
    circuit.failures = 0;
    circuit.state = "closed";
}
function recordFailure(serviceName) {
    const circuit = getCircuit(serviceName);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    if (circuit.failures >= FAILURE_THRESHOLD) {
        circuit.state = "open";
        console.error(`Circuit breaker opened for ${serviceName} after ${circuit.failures} failures`);
    }
}
function checkCircuit(serviceName) {
    const circuit = getCircuit(serviceName);
    updateCircuitState(circuit);
    if (circuit.state === "open") {
        throw new CircuitBreakerError(serviceName);
    }
}
// Wrapper function for calling external services with circuit breaker
function callWithCircuitBreaker(serviceName, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        checkCircuit(serviceName);
        try {
            const result = yield fn();
            recordSuccess(serviceName);
            return result;
        }
        catch (error) {
            recordFailure(serviceName);
            throw error;
        }
    });
}
