import React, { memo } from 'react';
import { motion } from 'framer-motion';
import Piece from './Piece';

const rows = ['8', '7', '6', '5', '4', '3', '2', '1'];
const cols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const getSquareName = (rowIdx, colIdx) => `${cols[colIdx]}${rows[rowIdx]}`;

const Square = memo(({ squareName, rowIdx, colIdx, cell, isSelected, isValidMove, isLastMove, isKingInCheck, onSquareClick, isFlipped }) => {
  const isDark = (rowIdx + colIdx) % 2 === 1;

  // Premium Wood Colors: Maple (Light) and Walnut (Dark)
  const baseColor = isDark ? 'bg-[#70432A]' : 'bg-[#D9A566]';

  // Dynamic Highlight Classes (using after: so texture shows underneath)
  let highlightClass = '';
  if (isSelected) highlightClass = 'after:bg-lime-400/50';
  else if (isKingInCheck) highlightClass = 'after:bg-red-500/60';
  else if (isLastMove) highlightClass = isDark ? 'after:bg-white/20' : 'after:bg-black/15';

  const showRank = isFlipped ? colIdx === 7 : colIdx === 0;
  const showFile = isFlipped ? rowIdx === 0 : rowIdx === 7;

  return (
    <div
      onClick={() => onSquareClick(squareName)}
      className={`relative flex items-center justify-center cursor-pointer transition-all duration-150 ${baseColor} 
        after:absolute after:inset-0 after:transition-colors after:duration-200 ${highlightClass}
      `}
      style={{
        // Subtle, repeating wood grain texture
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")',
        backgroundSize: '150px'
      }}
    >
      {/* Minimal Coordinates - Placed above the highlight overlay */}
      {showRank && (
        <span className={`absolute top-0.5 left-1 text-[8px] sm:text-[10px] font-black uppercase select-none z-10 ${isDark ? 'text-white/60' : 'text-black/40'
          }`}>
          {rows[rowIdx]}
        </span>
      )}
      {showFile && (
        <span className={`absolute bottom-0.5 right-1 text-[8px] sm:text-[10px] font-black uppercase select-none z-10 ${isDark ? 'text-white/60' : 'text-black/40'
          }`}>
          {cols[colIdx]}
        </span>
      )}

      {/* Valid Move Indicator - Black with 70% visibility */}
      {isValidMove && (
        <div className={`absolute z-10 pointer-events-none ${cell
            ? 'w-full h-full border-4 sm:border-[6px] border-black/70' // Dark outline on capture
            : 'w-4 h-4 sm:w-5 sm:h-5 bg-black/70 rounded-full' // Dark floating dot
          }`} />
      )}

      {/* Piece Animation */}
      {cell && (
        <motion.div
          initial={false}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="w-[85%] h-[85%] z-20 flex items-center justify-center drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]"
        >
          <Piece type={cell.type} color={cell.color} />
        </motion.div>
      )}
    </div>
  );
});

const ChessBoard = memo(({ game, selectedSquare, onSquareClick, validMoves, lastMove, playerColor }) => {
  const board = game.board();

  // Find king position if in check
  let kingInCheckPos = null;
  if (game.inCheck()) {
    const turn = game.turn();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          kingInCheckPos = getSquareName(r, c);
        }
      }
    }
  }

  const isFlipped = playerColor === 'b';
  const rowIndices = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colIndices = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="w-full h-full grid grid-cols-8 grid-rows-8 border-[8px] sm:border-[12px] border-[#2A1810] shadow-2xl relative bg-[#2A1810]">

      {/* Optional: A subtle inner shadow to make the board feel recessed into the frame */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] z-30" />

      {rowIndices.map((r) =>
        colIndices.map((c) => {
          const cell = board[r][c];
          const squareName = getSquareName(r, c);
          const isSelected = selectedSquare === squareName;
          const isValidMove = validMoves.some(m => m.to === squareName);
          const isLastMove = lastMove && (lastMove.from === squareName || lastMove.to === squareName);
          const isKingInCheck = kingInCheckPos === squareName;

          return (
            <Square
              key={squareName}
              squareName={squareName}
              rowIdx={r}
              colIdx={c}
              cell={cell}
              isSelected={isSelected}
              isValidMove={isValidMove}
              isLastMove={isLastMove}
              isKingInCheck={isKingInCheck}
              onSquareClick={onSquareClick}
              isFlipped={isFlipped}
            />
          );
        })
      )}
    </div>
  );
});

export default ChessBoard;