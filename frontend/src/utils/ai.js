/**
 * Calculates the best move using a Web Worker to prevent UI lag.
 * @param {string} fen - The current board state in FEN format.
 * @param {number} depth - The search depth.
 * @returns {Promise<string|null>} - The best move found.
 */
export function getBestMoveAsync(fen, depth = 3) {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };

    worker.postMessage({ fen, depth });
  });
}
