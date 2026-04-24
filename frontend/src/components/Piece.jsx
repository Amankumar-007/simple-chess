import React, { memo } from 'react';

const Piece = memo(({ type, color, className = "", style = {} }) => {
  // Mapping type and color to the provided SVG filenames
  // filenames: Chess_plt45.svg (white pawn), Chess_pdt45.svg (black pawn), etc.
  const pieceType = type.toLowerCase();
  const pieceColor = color.toLowerCase(); // 'w' -> 'l' (light), 'b' -> 'd' (dark)
  const colorCode = pieceColor === 'w' ? 'l' : 'd';
  
  const fileName = `Chess_${pieceType}${colorCode}t45.svg`;

  return (
    <img 
      src={`/${fileName}`} 
      className={`w-full h-full object-contain pointer-events-none select-none ${className}`}
      alt={`${color === 'w' ? 'White' : 'Black'} ${type}`}
      // Added a subtle drop shadow to make them pop against the wood board, but allow overrides
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))', ...style }}
    />
  );
});

export default Piece;