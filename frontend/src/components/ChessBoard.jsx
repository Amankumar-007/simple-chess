import React, { memo } from 'react';
import { motion } from 'framer-motion';
import Piece from './Piece';

const rows = ['8', '7', '6', '5', '4', '3', '2', '1'];
const cols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const getSquareName = (rowIdx, colIdx) => `${cols[colIdx]}${rows[rowIdx]}`;

const Square = memo(({ squareName, rowIdx, colIdx, cell, isSelected, isValidMove, isLastMove, isKingInCheck, onSquareClick, isFlipped }) => {
  const isDark = (rowIdx + colIdx) % 2 === 1;

  // Premium Tournament Color Palette
  const baseColor = isDark ? 'bg-[#739552]' : 'bg-[#EBECD0]';
  const textColor = isDark ? 'text-[#EBECD0]' : 'text-[#739552]';

  // Dynamic Highlight Classes (Layered over the base color)
  let highlightClass = '';
  if (isSelected) {
    highlightClass = 'after:bg-[#F6F669]/60'; // Bright, crisp yellow
  } else if (isKingInCheck) {
    // Beautiful radial glow for check instead of a flat red square
    highlightClass = 'after:bg-[radial-gradient(circle,rgba(255,0,0,0.8)_0%,rgba(255,0,0,0)_70%)]';
  } else if (isLastMove) {
    highlightClass = 'after:bg-[#F6F669]/30'; // Softer yellow trail
  }

  const showRank = isFlipped ? colIdx === 7 : colIdx === 0;
  const showFile = isFlipped ? rowIdx === 0 : rowIdx === 7;

  return (
    <div
      onClick={() => onSquareClick(squareName)}
      className={`relative flex items-center justify-center cursor-pointer transition-colors duration-200 ${baseColor} 
        after:absolute after:inset-0 after:transition-all after:duration-200 ${highlightClass}
      `}
    >
      {/* Refined Coordinates - Tighter font, perfectly placed */}
      {showRank && (
        <span className={`absolute top-1 left-1.5 text-[9px] sm:text-[11px] font-bold tracking-tight select-none z-10 ${textColor}`}>
          {rows[rowIdx]}
        </span>
      )}
      {showFile && (
        <span className={`absolute bottom-0.5 right-1.5 text-[9px] sm:text-[11px] font-bold tracking-tight select-none z-10 ${textColor}`}>
          {cols[colIdx]}
        </span>
      )}

      {/* Modern Valid Move Indicators */}
      {isValidMove && (
        <div className={`absolute z-10 pointer-events-none flex items-center justify-center w-full h-full`}>
          {cell ? (
            // Hollow ring for capturing a piece
            <div className="w-[85%] h-[85%] border-[5px] sm:border-[6px] border-black/20 rounded-full" />
          ) : (
            // Clean, tactile dot for moving to an empty square
            <div className="w-[22%] h-[22%] bg-black/20 rounded-full shadow-inner" />
          )}
        </div>
      )}

      {/* Enhanced Piece Animation & Shadow */}
      {cell && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          // Subtle drop shadow gives the pieces a 3D "standing" feel
          className="w-[88%] h-[88%] z-20 flex items-center justify-center drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]"
        >
          <Piece type={cell.type} color={cell.color} />
        </motion.div>
      )}
    </div>
  );
});

const ChessBoard = memo(({ game, selectedSquare, onSquareClick, validMoves, lastMove, playerColor }) => {
  const board = game.board();

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
    // Sleek container with a very subtle inner ring to frame the board perfectly
    <div className="w-full h-full grid grid-cols-8 grid-rows-8 rounded-lg overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.3)] ring-1 ring-black/10 relative bg-[#EBECD0]">
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