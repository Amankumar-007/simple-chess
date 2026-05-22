import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Chess } from 'chess.js';
import { socket } from '../socket';
import ChessBoard from './ChessBoard';
import Piece from './Piece';
import { Trophy, RotateCcw, MessageSquare, Send, Crown, ArrowLeft, ChevronRight, User, Skull, Link, Check, Eye, Cpu, Undo2, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getBestMoveAsync } from '../utils/ai';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

const PlayerCard = memo(({ color, isOpponent, playerColor, game, captured, score, opponents, name, time }) => {
  const isCurrentTurn = game.turn() === color;
  const isPlayer = playerColor === color;

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}s`;
  };

  return (
    <div className={`relative flex items-center gap-4 p-4 border-2 transition-all duration-300 ${isCurrentTurn ? 'border-lime-400 bg-lime-400/5' : 'border-white/10 opacity-60'
      }`}>
      {/* Brutalist Avatar Square */}
      <div className={`relative w-14 h-14 flex items-center justify-center transition-colors duration-300 ${isCurrentTurn ? 'bg-lime-400 text-black' : 'bg-transparent border-2 border-white/20 text-white'
        }`}>
        <User size={28} strokeWidth={2} />
        {isCurrentTurn && (
          <motion.div 
            layoutId="turn-indicator"
            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-lime-400 border-2 border-[#050505]" 
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-black tracking-tighter text-lg uppercase text-white truncate">
              {name}
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 uppercase tracking-widest ${color === 'w' ? 'bg-white text-black' : 'bg-white/10 text-white border border-white/20'
              }`}>
              {color === 'w' ? 'White' : 'Black'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {score > 0 && (
              <div className="flex items-center gap-1 bg-lime-400/10 px-2 py-0.5 border border-lime-400/20">
                <span className="text-lime-400 font-black text-[10px] tracking-widest">+ {score}</span>
              </div>
            )}
            <div className={`px-2 py-0.5 border-2 font-mono font-black text-xs tabular-nums ${isCurrentTurn ? 'bg-white text-black border-white' : 'border-white/10 text-white/40'}`}>
              {formatTime(time)}
            </div>
          </div>
        </div>

        {/* Captured Pieces Row — show actual piece color on contrasting bg */}
        <div className="flex flex-wrap items-center gap-0.5 h-6">
          {captured.map((type, i) => {
            // White player captures black pieces → show black pieces on WHITE bg (so they're visible)
            // Black player captures white pieces → show white pieces on BLACK bg (so they're visible)
            const capturedPieceColor = color === 'w' ? 'b' : 'w';
            const bgClass = color === 'w'
              ? 'bg-white/90 border border-white/30'   // light bg → black pieces visible
              : 'bg-black/80 border border-white/10';  // dark bg  → white pieces visible
            return (
              <div
                key={i}
                className={`w-5 h-5 flex items-center justify-center ${bgClass} hover:scale-110 transition-transform`}
              >
                <Piece
                  type={type}
                  color={capturedPieceColor}
                  style={{ width: '80%', height: '80%' }}
                />
              </div>
            );
          })}
          {captured.length === 0 && (
            <div className="w-full h-0.5 bg-white/5 rounded-full" />
          )}
        </div>
      </div>

      {isOpponent && opponents.length === 0 && (
        <div className="absolute inset-0 bg-[#050505]/95 border-2 border-white/10 flex items-center justify-center z-10 backdrop-blur-sm">
          <span className="text-[10px] font-black tracking-[0.4em] text-white/40 animate-pulse uppercase">Awaiting Challenger</span>
        </div>
      )}
    </div>
  );
});

const ChessGame = ({ roomId, playerName, onLeave, isPvE = false, difficulty = 2 }) => {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [playerColor, setPlayerColor] = useState(null);
  const [opponents, setOpponents] = useState([]);
  const [status, setStatus] = useState('WAITING...');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [timers, setTimers] = useState({ w: 0, b: 0 });
  const [viewIndex, setViewIndex] = useState(-1); // -1 means current live state

  const gameRef = useRef(game);
  gameRef.current = game;

  // Guard to prevent multiple simultaneous CPU move triggers
  const cpuThinkingRef = useRef(false);

  const gameStarted = game.history().length > 0;

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate captured pieces and relative score based on current game state
  const scoreData = useMemo(() => {
    // We always calculate scores based on the FULL game history, not just the viewed move
    const board = game.board().flat().filter(p => p !== null);
    const initialCounts = {
      w: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 },
      b: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 }
    };

    board.forEach(p => {
      initialCounts[p.color][p.type]--;
    });

    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const lost = { w: [], b: [] };
    const lostValue = { w: 0, b: 0 };

    ['w', 'b'].forEach(color => {
      // Sort pieces by value to show them in a nice order (e.g. Pawns first, then Knights, etc.)
      const order = ['p', 'n', 'b', 'r', 'q'];
      order.forEach(type => {
        const count = initialCounts[color][type];
        for (let i = 0; i < count; i++) {
          lost[color].push(type);
          lostValue[color] += pieceValues[type];
        }
      });
    });

    return {
      capturedBy: {
        w: lost.b, // White captured Black's lost pieces
        b: lost.w  // Black captured White's lost pieces
      },
      score: {
        w: Math.max(0, lostValue.b - lostValue.w),
        b: Math.max(0, lostValue.w - lostValue.b)
      }
    };
  }, [game]);

  const makeCpuMove = useCallback(() => {
    if (!isPvE || game.isGameOver() || game.turn() === playerColor) return;
    // Prevent double-firing: if a CPU move is already in flight, bail out
    if (cpuThinkingRef.current) return;
    cpuThinkingRef.current = true;

    const currentFen = game.fen();
    getBestMoveAsync(currentFen, difficulty).then((bestMove) => {
      cpuThinkingRef.current = false;
      if (bestMove) {
        setGame(currentGame => {
          // Only apply move if the board hasn't changed (e.g. undo wasn't hit)
          if (currentGame.fen() !== currentFen) return currentGame;
          const nextGame = new Chess();
          nextGame.loadPgn(currentGame.pgn());
          const result = nextGame.move(bestMove);
          if (result) {
            setViewIndex(-1);
            return nextGame;
          }
          return currentGame;
        });
      }
    }).catch(() => {
      cpuThinkingRef.current = false;
    });
  }, [isPvE, game, playerColor, difficulty]);

  const updateGame = useCallback((move) => {
    try {
      const currentGame = gameRef.current;
      const nextGame = new Chess();
      nextGame.loadPgn(currentGame.pgn());
      const result = nextGame.move(move);
      if (result) {
        setGame(nextGame);
        setViewIndex(-1);
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }, []);

  useEffect(() => {
    if (isPvE) {
      setPlayerColor('w'); // In PvE, user is White by default
      setStatus('READY');
      return;
    }

    socket.emit('joinRoom', { roomId, playerName });

    socket.on('error', (msg) => {
      onLeave(msg);
    });

    socket.on('roomJoined', ({ players, yourColor }) => {
      setPlayerColor(yourColor);
      setOpponents(players.filter(p => p.id !== socket.id));
      if (players.length === 2) setStatus('READY');
    });

    socket.on('playerJoined', (players) => {
      setOpponents(players.filter(p => p.id !== socket.id));
      if (players.length === 2) setStatus('READY');
    });

    socket.on('playerLeft', (players) => {
      setOpponents(players.filter(p => p.id !== socket.id));
      setStatus('ALONE');
    });

    socket.on('move', (move) => {
      updateGame(move);
    });

    socket.on('resetGame', () => {
      setGame(new Chess());
      setSelectedSquare(null);
      setValidMoves([]);
      setViewIndex(-1);
    });

    socket.on('chatMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off('error');
      socket.off('roomJoined');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('move');
      socket.off('resetGame');
      socket.off('chatMessage');
    };
  }, [roomId, playerName, updateGame, onLeave, isPvE]);

  useEffect(() => {
    // Only fire CPU move when it's truly the CPU's turn in live view
    if (isPvE && playerColor && game.turn() !== playerColor && viewIndex === -1 && !game.isGameOver()) {
      makeCpuMove();
    }
  }, [game, isPvE, playerColor, makeCpuMove, viewIndex]);

  useEffect(() => {
    if (!gameStarted || game.isGameOver()) return;

    const interval = setInterval(() => {
      const turn = game.turn();
      setTimers(prev => ({
        ...prev,
        [turn]: prev[turn] + 50
      }));
    }, 50);

    return () => clearInterval(interval);
  }, [game, gameStarted]);

  useEffect(() => {
    if (game.isGameOver()) {
      setShowGameOverModal(true);
      if (game.isCheckmate()) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ffffff', '#a3e635', '#000000'],
          disableForReducedMotion: true
        });
      }
    }
  }, [game]);

  const onSquareClick = (square) => {
    // Only allow moves if we are at the live state
    if (viewIndex !== -1 && viewIndex !== game.history().length) return;
    if (!playerColor || game.turn() !== playerColor) return;

    if (selectedSquare) {
      const move = { from: selectedSquare, to: square, promotion: 'q' };
      const success = updateGame(move);
      if (success) {
        if (!isPvE) {
          socket.emit('move', { roomId, move });
        }
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }
    }

    const piece = game.get(square);
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      setValidMoves(game.moves({ square, verbose: true }));
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const resetGame = () => {
    if (!isPvE) {
      socket.emit('resetGame', roomId);
    }
    setGame(new Chess());
    setSelectedSquare(null);
    setValidMoves([]);
    setTimers({ w: 0, b: 0 });
    setViewIndex(-1);
    setShowGameOverModal(false);
  };

  const undoMove = () => {
    const newGame = new Chess();
    newGame.loadPgn(game.pgn());
    const undoneMove = newGame.undo();
    if (isPvE && undoneMove) {
      newGame.undo();
    }
    setGame(newGame);
    setViewIndex(-1);
    if (!isPvE) socket.emit('undoMove', roomId);
  };

  const getDisplayGame = () => {
    const history = game.history({ verbose: true });
    // If viewIndex is live (-1) or out of bounds, return the live game
    if (viewIndex === -1 || viewIndex > history.length) return game;
    
    const tempGame = new Chess();
    for (let i = 0; i < viewIndex; i++) {
      if (history[i]) {
        tempGame.move(history[i]);
      }
    }
    return tempGame;
  };

  const displayGame = useMemo(() => getDisplayGame(), [game, viewIndex]);
  const history = game.history();

  const lastDisplayedMove = useMemo(() => {
    const hist = displayGame.history({ verbose: true });
    return hist.length > 0 ? hist[hist.length - 1] : null;
  }, [displayGame]);

  const displayStatus = useMemo(() => {
    if (!isPvE && opponents.length === 0) {
      return status === 'ALONE' ? 'ALONE' : 'WAITING...';
    }
    if (!isPvE && status === 'WAITING...') {
      return 'WAITING...';
    }
    
    if (displayGame.isGameOver()) {
      if (displayGame.isCheckmate()) {
        return `${displayGame.turn() === 'w' ? 'BLACK' : 'WHITE'} WINS!`;
      } else if (displayGame.isDraw()) {
        return 'DRAW';
      } else {
        return 'GAME OVER';
      }
    }
    
    const turn = displayGame.turn() === 'w' ? 'WHITE' : 'BLACK';
    const isCheck = displayGame.inCheck();
    return isCheck ? `CHECK! (${turn})` : `${turn} TURN`;
  }, [isPvE, opponents, status, displayGame]);

  useEffect(() => {
    if (isPvE) return;

    const handleUndoMove = () => {
      setGame(prevGame => {
        const newGame = new Chess();
        newGame.loadPgn(prevGame.pgn());
        newGame.undo();
        return newGame;
      });
      setViewIndex(-1);
    };

    socket.on('undoMove', handleUndoMove);
    return () => {
      socket.off('undoMove', handleUndoMove);
    };
  }, [isPvE]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isPvE) return;
    socket.emit('chatMessage', { roomId, message: inputMessage, sender: playerColor === 'w' ? 'White' : 'Black' });
    setInputMessage('');
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#050505] text-white selection:bg-lime-400 selection:text-black font-sans">

      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:flex w-20 border-r-2 border-white/10 flex-col items-center py-8 gap-8">
        <div className="w-12 h-12 bg-white flex items-center justify-center text-black">
          <Crown size={28} strokeWidth={2.5} />
        </div>
        <div className="flex-1"></div>
        <button
          onClick={() => onLeave()}
          className="w-12 h-12 border-2 border-white/20 hover:border-red-500 hover:text-red-500 transition-all flex items-center justify-center text-white/50 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-12 space-y-6 lg:space-y-8 relative">

        {/* Stark Header Status Bar */}
        <div className="w-full max-w-[560px] flex items-stretch border-2 border-white/10 h-14">
          <div className="flex flex-col justify-center px-4 border-r-2 border-white/10 bg-white/5">
            <span className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none">
              {isPvE ? 'Difficulty' : 'Room'}
            </span>
            <span className="font-black text-lime-400 tracking-wider leading-tight">
              {isPvE ? difficulty : roomId}
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 bg-[#050505]">
            <span className="text-sm md:text-lg font-black tracking-widest uppercase text-white">
              {displayStatus}
            </span>
          </div>
          <button
            onClick={copyLink}
            className="px-4 border-l-2 border-white/10 hover:bg-white hover:text-black transition-colors text-white/50 flex items-center justify-center"
            title="Copy Invite Link"
          >
            {copied ? <Check size={20} strokeWidth={2.5} /> : <Link size={20} strokeWidth={2.5} />}
          </button>
          <button
            onClick={resetGame}
            className="px-4 border-l-2 border-white/10 hover:bg-white hover:text-black transition-colors text-white/50 flex items-center justify-center"
            title="Reset Game"
          >
            <RotateCcw size={20} strokeWidth={2.5} />
          </button>
          {game.isGameOver() && !showGameOverModal && (
            <button
              onClick={() => setShowGameOverModal(true)}
              className="px-4 border-l-2 border-white/10 bg-lime-400 text-black hover:bg-lime-300 transition-colors flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest"
              title="Show Result"
            >
              <Trophy size={16} />
              <span>Result</span>
            </button>
          )}
        </div>

        {/* Player Top */}
        <div className="w-full max-w-[560px]">
          <PlayerCard
            color={playerColor === 'w' ? 'b' : 'w'}
            isOpponent={true}
            playerColor={playerColor}
            game={displayGame}
            captured={scoreData.capturedBy[playerColor === 'w' ? 'b' : 'w']}
            score={scoreData.score[playerColor === 'w' ? 'b' : 'w']}
            opponents={isPvE ? [{ name: 'Computer' }] : opponents}
            name={isPvE ? 'Computer' : (opponents.length > 0 ? opponents[0].name : 'Waiting...')}
            time={timers[playerColor === 'w' ? 'b' : 'w']}
          />
        </div>

        {/* Board Container */}
        <div className="relative shadow-[8px_8px_0px_rgba(255,255,255,0.05)] w-full max-w-[560px] aspect-square">
          <ChessBoard
            game={displayGame}
            onSquareClick={onSquareClick}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            lastMove={lastDisplayedMove}
            playerColor={playerColor}
          />
        </div>

        {/* Player Bottom */}
        <div className="w-full max-w-[560px]">
          <PlayerCard
            color={playerColor === 'w' ? 'w' : 'b'}
            isOpponent={false}
            playerColor={playerColor}
            game={displayGame}
            captured={scoreData.capturedBy[playerColor === 'w' ? 'w' : 'b']}
            score={scoreData.score[playerColor === 'w' ? 'w' : 'b']}
            opponents={opponents}
            name={playerName || 'You'}
            time={timers[playerColor === 'w' ? 'w' : 'b']}
          />
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-2 bg-[#050505] border-2 border-white/10 p-2">
          <button 
            onClick={() => setViewIndex(0)}
            disabled={history.length === 0 || viewIndex === 0}
            className="p-3 hover:bg-white/5 transition-colors text-white/50 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
            title="First Move"
          >
            <ChevronsLeft size={20} />
          </button>
          <button 
            onClick={() => setViewIndex(prev => {
              if (prev === -1) return history.length - 1;
              return Math.max(0, prev - 1);
            })}
            disabled={history.length === 0 || viewIndex === 0}
            className="p-3 hover:bg-white/5 transition-colors text-white/50 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
            title="Previous Move"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={undoMove}
            disabled={history.length === 0 || (viewIndex !== -1 && viewIndex !== history.length)}
            className="px-6 py-2 border-2 border-white/10 hover:border-white/40 hover:bg-white/5 transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest disabled:opacity-20"
          >
            <Undo2 size={16} />
            <span>Undo</span>
          </button>
          <button 
            onClick={() => setViewIndex(prev => {
              if (prev === -1 || prev === history.length) return -1;
              if (prev === history.length - 1) return -1;
              return prev + 1;
            })}
            disabled={history.length === 0 || viewIndex === -1 || viewIndex === history.length}
            className="p-3 hover:bg-white/5 transition-colors text-white/50 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
            title="Next Move"
          >
            <ChevronRight size={20} />
          </button>
          <button 
            onClick={() => setViewIndex(-1)}
            disabled={history.length === 0 || viewIndex === -1}
            className="p-3 hover:bg-white/5 transition-colors text-white/50 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
            title="Last Move"
          >
            <ChevronsRight size={20} />
          </button>
        </div>

        {/* Brutalist Game Over Modal */}
        <AnimatePresence>
          {showGameOverModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#050505]/90"
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#050505] border-4 border-white p-8 max-w-sm w-full text-center space-y-8 shadow-[12px_12px_0px_rgba(163,230,53,1)]"
              >
                <div className="w-20 h-20 bg-lime-400 mx-auto flex items-center justify-center">
                  <Trophy size={40} className="text-black" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-white mb-2">
                    {game.isCheckmate() ? 'Checkmate.' : 'Game Over.'}
                  </h2>
                  <p className="text-white/60 font-bold uppercase tracking-widest text-xs">
                    {game.isCheckmate()
                      ? `${game.turn() === 'w' ? 'Black' : 'White'} takes the crown.`
                      : 'The match ended in a draw.'}
                  </p>
                </div>
                <div className="space-y-4">
                  <button
                    onClick={resetGame}
                    className="w-full bg-lime-400 text-black font-black py-4 hover:bg-lime-300 transition-colors uppercase tracking-widest text-sm border-2 border-lime-400"
                  >
                    Rematch
                  </button>
                  <button
                    onClick={() => setShowGameOverModal(false)}
                    className="w-full bg-white text-black font-black py-4 hover:bg-white/90 transition-colors uppercase tracking-widest text-sm border-2 border-white flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    Review Board
                  </button>
                  <button
                    onClick={() => onLeave()}
                    className="w-full bg-transparent text-white font-black py-4 hover:bg-white hover:text-black transition-colors uppercase tracking-widest text-xs border-2 border-white/20 hover:border-white"
                  >
                    Exit to Lobby
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Sidebar - Chat & Stats (Desktop) */}
      <div className="hidden lg:flex w-[380px] border-l-2 border-white/10 bg-[#050505] flex-col">
        <div className="p-6 border-b-2 border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <Skull size={24} className="text-white" />
            <h2 className="font-black text-xl tracking-widest uppercase">Match Data</h2>
          </div>
          {viewIndex !== -1 && (
            <span className="text-[10px] font-black bg-lime-400 text-black px-2 py-1 uppercase tracking-widest">
              Reviewing
            </span>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
          {/* Brutalist Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border-2 border-white/10 space-y-1">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Moves</span>
              <p className="text-3xl font-black text-white">{history.length}</p>
            </div>
            <div className="p-4 border-2 border-white/10 space-y-1">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Status</span>
              <p className="text-3xl font-black text-lime-400 tracking-tighter truncate">
                {displayGame.inCheck() ? 'CHECK' : 'CLEAR'}
              </p>
            </div>
          </div>

          {/* Move List / History */}
          <div className="flex-1 flex flex-col min-h-0 border-2 border-white/10 overflow-hidden">
            <div className="p-3 border-b-2 border-white/10 bg-white/5">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Move History</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => (
                  <React.Fragment key={i}>
                    <div 
                      onClick={() => setViewIndex(i * 2 + 1)}
                      className={`p-2 text-xs font-bold cursor-pointer transition-colors ${(viewIndex === i * 2 + 1 || (viewIndex === -1 && i * 2 + 1 === history.length)) ? 'bg-lime-400 text-black' : 'hover:bg-white/5 text-white/60'}`}
                    >
                      <span className="text-white/30 mr-2">{i + 1}.</span>
                      {history[i * 2]}
                    </div>
                    {history[i * 2 + 1] && (
                      <div 
                        onClick={() => setViewIndex(i * 2 + 2)}
                        className={`p-2 text-xs font-bold cursor-pointer transition-colors ${(viewIndex === i * 2 + 2 || (viewIndex === -1 && i * 2 + 2 === history.length)) ? 'bg-lime-400 text-black' : 'hover:bg-white/5 text-white/60'}`}
                      >
                        {history[i * 2 + 1]}
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Integration */}
          <div className="flex-1 flex flex-col space-y-4 min-h-0">
            <div className="flex items-center justify-between border-b-2 border-white/10 pb-2">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Comms Feed</span>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide">
              {messages.map((msg, idx) => {
                const isMe = msg.sender === (playerColor === 'w' ? 'White' : 'Black');
                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-3 text-sm font-bold tracking-wide ${isMe
                        ? 'bg-lime-400 text-black border-2 border-lime-400'
                        : 'bg-transparent text-white border-2 border-white/20'
                      }`}>
                      <p>{msg.message}</p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-white/20 uppercase font-black text-xs tracking-[0.3em] text-center px-4">
                  Awaiting Transmission
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="relative pt-4">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="TYPE MESSAGE..."
                className="w-full bg-transparent border-b-4 border-white/20 pl-0 pr-12 py-3 text-white text-sm font-black tracking-widest focus:outline-none focus:border-lime-400 transition-colors placeholder:text-white/20"
              />
              <button type="submit" className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 text-white hover:text-lime-400 transition-colors flex items-center justify-center">
                <Send size={20} strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile Chat Toggle - Stark Square */}
      <button
        onClick={() => setShowChat(true)}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-lime-400 text-black flex items-center justify-center shadow-[4px_4px_0px_#ffffff] active:translate-y-1 active:translate-x-1 active:shadow-[0px_0px_0px_#ffffff] transition-all z-40"
      >
        <MessageSquare size={24} strokeWidth={2.5} />
      </button>

      {/* Mobile Chat Drawer */}
      <AnimatePresence>
        {showChat && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChat(false)}
              className="fixed inset-0 bg-[#050505]/80 z-50 lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[75vh] bg-[#050505] border-t-4 border-lime-400 z-[60] lg:hidden p-6 flex flex-col gap-6"
            >
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4">
                <h3 className="font-black text-xl uppercase tracking-widest text-white">Comms Feed</h3>
                <button onClick={() => setShowChat(false)} className="p-2 bg-white/5 text-white/50 hover:text-white"><ChevronRight className="rotate-90" /></button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                {messages.map((msg, idx) => {
                  const isMe = msg.sender === (playerColor === 'w' ? 'White' : 'Black');
                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] p-3 text-sm font-bold tracking-wide ${isMe
                          ? 'bg-lime-400 text-black'
                          : 'bg-transparent text-white border-2 border-white/20'
                        }`}>
                        <p>{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendMessage} className="relative mt-auto">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="TYPE MESSAGE..."
                  className="w-full bg-transparent border-4 border-white/20 focus:border-lime-400 pl-4 pr-16 py-4 text-white font-black tracking-widest focus:outline-none transition-colors placeholder:text-white/30 rounded-none"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-white text-black flex items-center justify-center hover:bg-lime-400 transition-colors">
                  <Send size={20} strokeWidth={2.5} />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChessGame;