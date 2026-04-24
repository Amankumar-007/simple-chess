import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Chess } from 'chess.js';
import { socket } from '../socket';
import ChessBoard from './ChessBoard';
import Piece from './Piece';
import { Trophy, RotateCcw, MessageSquare, Send, Crown, ArrowLeft, ChevronRight, User, Skull, Link, Check, Eye } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

const PlayerCard = memo(({ color, isOpponent, playerColor, game, capturedPieces, opponents, name }) => {
  const isCurrentTurn = game.turn() === color;
  const isPlayer = playerColor === color;
  const captured = capturedPieces[color];

  return (
    <div className={`relative flex items-center gap-4 p-4 border-2 transition-all duration-300 ${isCurrentTurn ? 'border-lime-400 bg-lime-400/5' : 'border-white/10 opacity-50 grayscale'
      }`}>
      {/* Brutalist Avatar Square */}
      <div className={`relative w-14 h-14 flex items-center justify-center transition-colors duration-300 ${isCurrentTurn ? 'bg-lime-400 text-black' : 'bg-transparent border-2 border-white/20 text-white'
        }`}>
        <User size={28} strokeWidth={2} />
        {isCurrentTurn && (
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-lime-400 border-2 border-[#050505]" />
        )}
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="font-black tracking-tighter text-lg uppercase text-white">
            {name}
          </span>
          <span className={`text-[10px] font-black px-2 py-1 uppercase tracking-widest ${color === 'w' ? 'bg-white text-black' : 'bg-white/10 text-white'
            }`}>
            {color === 'w' ? 'White' : 'Black'}
          </span>
        </div>

        {/* Captured Pieces Minimal Grid */}
        <div className="flex flex-wrap gap-1 min-h-[1.5rem]">
          {captured.map((type, i) => {
            const pieceColor = color === 'w' ? 'b' : 'w';
            return (
              <div key={i} className="w-4 h-4 opacity-60">
                <Piece 
                  type={type} 
                  color={pieceColor} 
                  style={pieceColor === 'b' ? { filter: 'drop-shadow(0 0 3px rgba(255,255,255,1))' } : {}}
                />
              </div>
            );
          })}
          {captured.length > 0 && (
            <span className="text-[10px] font-black text-lime-400 ml-2 self-center">+{captured.length}</span>
          )}
        </div>
      </div>

      {isOpponent && opponents.length === 0 && (
        <div className="absolute inset-0 bg-[#050505]/90 border-2 border-white/10 flex items-center justify-center z-10">
          <span className="text-[10px] font-black tracking-[0.3em] text-white/50 animate-pulse uppercase">Waiting for player...</span>
        </div>
      )}
    </div>
  );
});

const ChessGame = ({ roomId, playerName, onLeave }) => {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);
  const [opponents, setOpponents] = useState([]);
  const [status, setStatus] = useState('WAITING...');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate captured pieces (Unchanged Logic)
  const capturedPieces = useMemo(() => {
    const board = game.board().flat().filter(p => p !== null);
    const initialCounts = {
      w: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 },
      b: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 }
    };

    board.forEach(p => {
      initialCounts[p.color][p.type]--;
    });

    const captured = { w: [], b: [] };
    ['w', 'b'].forEach(color => {
      Object.entries(initialCounts[color]).forEach(([type, count]) => {
        for (let i = 0; i < count; i++) {
          captured[color].push(type);
        }
      });
    });

    return captured;
  }, [game]);

  const updateGame = useCallback((move) => {
    try {
      const result = game.move(move);
      if (result) {
        setGame(new Chess(game.fen()));
        setLastMove(result);
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }, [game]);

  useEffect(() => {
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
      setLastMove(null);
      setSelectedSquare(null);
      setValidMoves([]);
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
  }, [roomId, playerName, updateGame, onLeave]);

  useEffect(() => {
    if (game.isGameOver()) {
      setShowGameOverModal(true);
      if (game.isCheckmate()) {
        setStatus(`${game.turn() === 'w' ? 'BLACK' : 'WHITE'} WINS!`);
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ffffff', '#a3e635', '#000000'],
          disableForReducedMotion: true
        });
      } else if (game.isDraw()) {
        setStatus('DRAW');
      } else {
        setStatus('GAME OVER');
      }
    } else {
      const turn = game.turn() === 'w' ? 'WHITE' : 'BLACK';
      const isCheck = game.inCheck();
      setStatus(isCheck ? `CHECK! (${turn})` : `${turn} TURN`);
    }
  }, [game]);

  const onSquareClick = (square) => {
    if (!playerColor || game.turn() !== playerColor) return;

    if (selectedSquare) {
      const move = { from: selectedSquare, to: square, promotion: 'q' };
      const success = updateGame(move);
      if (success) {
        socket.emit('move', { roomId, move });
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
    socket.emit('resetGame', roomId);
    setGame(new Chess());
    setLastMove(null);
    setSelectedSquare(null);
    setValidMoves([]);
    setShowGameOverModal(false);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
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
            <span className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none">Room</span>
            <span className="font-black text-lime-400 tracking-wider leading-tight">{roomId}</span>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 bg-[#050505]">
            <span className="text-sm md:text-lg font-black tracking-widest uppercase text-white">
              {status}
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
            game={game}
            capturedPieces={capturedPieces}
            opponents={opponents}
            name={opponents.length > 0 ? opponents[0].name : 'Waiting...'}
          />
        </div>

        {/* Board Container - Removed Blur, Added Sharp Shadow */}
        <div className="relative shadow-[8px_8px_0px_rgba(255,255,255,0.05)] w-full max-w-[560px] aspect-square">
          <ChessBoard
            game={game}
            onSquareClick={onSquareClick}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            lastMove={lastMove}
          />
        </div>

        {/* Player Bottom */}
        <div className="w-full max-w-[560px]">
          <PlayerCard
            color={playerColor === 'w' ? 'w' : 'b'}
            isOpponent={false}
            playerColor={playerColor}
            game={game}
            capturedPieces={capturedPieces}
            opponents={opponents}
            name={playerName || 'You'}
          />
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
        <div className="p-6 border-b-2 border-white/10 flex items-center gap-3 bg-white/5">
          <Skull size={24} className="text-white" />
          <h2 className="font-black text-xl tracking-widest uppercase">Match Data</h2>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-8">
          {/* Brutalist Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border-2 border-white/10 space-y-1">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Moves</span>
              <p className="text-3xl font-black text-white">{game.history().length}</p>
            </div>
            <div className="p-4 border-2 border-white/10 space-y-1">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Status</span>
              <p className="text-3xl font-black text-lime-400 tracking-tighter">
                {game.inCheck() ? 'CHECK' : 'CLEAR'}
              </p>
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