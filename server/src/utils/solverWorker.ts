import { parentPort, workerData } from 'worker_threads';
import { solvePuzzle } from './puzzleSolver';

interface WorkerData {
  pattern: number[];
  size: number;
  maxMoves: number;
}

const { pattern, size, maxMoves } = workerData as WorkerData;

try {
  const result = solvePuzzle(pattern, size, maxMoves);
  if (parentPort) parentPort.postMessage(result);
} catch (error: any) {
  if (parentPort) parentPort.postMessage({ error: error.message });
} 