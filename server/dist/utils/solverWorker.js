"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const puzzleSolver_1 = require("./puzzleSolver");
const { pattern, size, maxMoves } = worker_threads_1.workerData;
try {
    const result = (0, puzzleSolver_1.solvePuzzle)(pattern, size, maxMoves);
    if (worker_threads_1.parentPort)
        worker_threads_1.parentPort.postMessage(result);
}
catch (error) {
    if (worker_threads_1.parentPort)
        worker_threads_1.parentPort.postMessage({ error: error.message });
}
