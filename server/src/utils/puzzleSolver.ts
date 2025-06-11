/**
 * Lights Out Puzzle Solver using Breadth-First Search
 * 
 * This module provides a solver that finds the minimum number of moves
 * required to solve a Lights Out puzzle, or determines if it's unsolvable.
 */

// Type definitions
type Grid = boolean[][];
type Move = { row: number; col: number };
type QueueItem = {
  grid: Grid;
  moves: Move[];
};

/**
 * Converts a pattern of linear indices to a grid representation
 * @param pattern Array of linear indices (1-based)
 * @param size Grid size (default 5)
 * @returns 2D boolean grid
 */
export function patternToGrid(pattern: number[], size: number = 5): Grid {
  // Initialize empty grid
  const grid: Grid = Array(size).fill(false).map(() => Array(size).fill(false));
  
  // Set the lights that are on
  for (const linearIndex of pattern) {
    const row = Math.floor((linearIndex - 1) / size);
    const col = (linearIndex - 1) % size;
    grid[row][col] = true;
  }
  
  return grid;
}

/**
 * Converts a grid representation to a pattern of linear indices
 * @param grid 2D boolean grid
 * @returns Array of linear indices (1-based)
 */
export function gridToPattern(grid: Grid): number[] {
  const pattern: number[] = [];
  const size = grid.length;
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row][col]) {
        const linearIndex = row * size + col + 1;
        pattern.push(linearIndex);
      }
    }
  }
  
  return pattern;
}

/**
 * Creates a deep copy of a grid
 * @param grid Grid to copy
 * @returns Copy of the grid
 */
function copyGrid(grid: Grid): Grid {
  return grid.map(row => [...row]);
}

/**
 * Toggles a cell and its adjacent cells
 * @param grid Grid to modify
 * @param row Row index
 * @param col Column index
 * @returns Modified grid (the input grid is modified in place)
 */
function toggleCell(grid: Grid, row: number, col: number): Grid {
  const size = grid.length;
  
  // Toggle the clicked cell
  grid[row][col] = !grid[row][col];
  
  // Toggle adjacent cells (up, down, left, right)
  const directions = [
    [-1, 0], // up
    [1, 0],  // down
    [0, -1], // left
    [0, 1]   // right
  ];
  
  for (const [dx, dy] of directions) {
    const newRow = row + dx;
    const newCol = col + dy;
    
    // Check if the adjacent cell is within grid bounds
    if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
      grid[newRow][newCol] = !grid[newRow][newCol];
    }
  }
  
  return grid;
}

/**
 * Checks if all lights are off in the grid
 * @param grid Grid to check
 * @returns True if all lights are off
 */
function isAllOff(grid: Grid): boolean {
  return grid.every(row => row.every(cell => !cell));
}

/**
 * Serializes a grid to a string for use as a hash key
 * @param grid Grid to serialize
 * @returns String representation of the grid
 */
function serializeGrid(grid: Grid): string {
  return grid.map(row => row.map(cell => cell ? '1' : '0').join('')).join('');
}

// Precompute toggle masks for each of the 25 cells for bitmask representation
const TOGGLE_MASKS: number[] = (() => {
  const masks: number[] = [];
  const size = 5;
  for (let i = 0; i < size * size; i++) {
    let mask = 0;
    const row = Math.floor(i / size);
    const col = i % size;
    // Toggle self
    mask |= 1 << i;
    // Directions
    const deltas = [ [-1,0], [1,0], [0,-1], [0,1] ];
    for (const [dr, dc] of deltas) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < size && c >= 0 && c < size) {
        mask |= 1 << (r * size + c);
      }
    }
    masks.push(mask);
  }
  return masks;
})();

// Convert boolean grid to bitmask
function gridToMask(grid: Grid): number {
  let mask = 0;
  const size = grid.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        mask |= 1 << (r * size + c);
      }
    }
  }
  return mask;
}

// Convert pattern to bitmask directly
export function patternToMask(pattern: number[], size: number = 5): number {
  let mask = 0;
  for (const idx of pattern) {
    const i = idx - 1;
    mask |= 1 << i;
  }
  return mask;
}

// Bidirectional BFS solver
export function solvePuzzle(pattern: number[], size: number = 5, maxMoves: number = 20) {
  const startMask = patternToMask(pattern, size);
  if (startMask === 0) return { solvable: true, minimumMoves: 0, solution: [] };

  const goalMask = 0;
  const frontVisited = new Map<number, number[]>();
  const backVisited = new Map<number, number[]>();
  frontVisited.set(startMask, []);
  backVisited.set(goalMask, []);
  let frontQueue = [startMask];
  let backQueue = [goalMask];

  for (let depth = 0; depth < maxMoves; depth++) {
    // Expand the smaller frontier
    if (frontQueue.length <= backQueue.length) {
      const nextQueue: number[] = [];
      for (const mask of frontQueue) {
        const path = frontVisited.get(mask)!;
        for (let i = 0; i < size * size; i++) {
          const nextMask = mask ^ TOGGLE_MASKS[i];
          if (frontVisited.has(nextMask)) continue;
          const nextPath = [...path, i + 1];
          if (backVisited.has(nextMask)) {
            const backPath = backVisited.get(nextMask)!;
            const solution = nextPath.concat(backPath.slice().reverse());
            return { solvable: true, minimumMoves: solution.length, solution };
          }
          frontVisited.set(nextMask, nextPath);
          nextQueue.push(nextMask);
        }
      }
      frontQueue = nextQueue;
    } else {
      const nextQueue: number[] = [];
      for (const mask of backQueue) {
        const path = backVisited.get(mask)!;
        for (let i = 0; i < size * size; i++) {
          const nextMask = mask ^ TOGGLE_MASKS[i];
          if (backVisited.has(nextMask)) continue;
          const nextPath = [...path, i + 1];
          if (frontVisited.has(nextMask)) {
            const frontPath = frontVisited.get(nextMask)!;
            const solution = frontPath.concat(nextPath.slice().reverse());
            return { solvable: true, minimumMoves: solution.length, solution };
          }
          backVisited.set(nextMask, nextPath);
          nextQueue.push(nextMask);
        }
      }
      backQueue = nextQueue;
    }
  }

  return { solvable: false, minimumMoves: null, solution: null };
} 