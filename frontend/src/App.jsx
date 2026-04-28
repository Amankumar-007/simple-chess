import { useState, useEffect } from 'react'
import ChessGame from './components/ChessGame'
import { Crown, Play, Users, Plus, Hash, User, ChevronRight } from 'lucide-react'
import { socket } from './socket'
import { motion, AnimatePresence } from 'framer-motion'

function App() {
  const [roomId, setRoomId] = useState('')
  const [roomName, setRoomName] = useState('')
  const [inGame, setInGame] = useState(false)
  const [stats, setStats] = useState({ onlinePlayers: 0, activeRooms: 0 })
  const [error, setError] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [hasName, setHasName] = useState(false)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [gameMode, setGameMode] = useState('PVP') // 'PVP' or 'PVE'
  const [difficulty, setDifficulty] = useState(2)
  const [selectingDifficulty, setSelectingDifficulty] = useState(false)

  useEffect(() => {
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    if (pathParts.length >= 2) {
      setRoomName(pathParts[0])
      setRoomId(pathParts[1])
    }

    socket.on('statsUpdate', (data) => {
      setStats(data)
    })

    socket.on('error', (msg) => {
      setError(msg)
      setTimeout(() => setError(''), 3000)
    })

    return () => {
      socket.off('statsUpdate')
      socket.off('error')
    }
  }, [])

  const handleCreateRoom = (e) => {
    e.preventDefault()
    if (roomName.includes(' ')) {
      setError('Spaces are not allowed in the room name')
      setTimeout(() => setError(''), 3000)
      return
    }
    if (!roomName.trim()) return

    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()
    setRoomId(newRoomId)
    setGameMode('PVP')
    window.history.pushState(null, '', `/${roomName}/${newRoomId}`)
    setInGame(true)
  }

  const handleStartPVE = (level) => {
    setDifficulty(level)
    setGameMode('PVE')
    setRoomId('CPU-' + level)
    setInGame(true)
  }

  const handleJoinRoom = (e) => {
    e.preventDefault()
    if (roomId.length >= 4) {
      window.history.pushState(null, '', `/join/${roomId}`)
      setInGame(true)
    }
  }

  const handleNameSubmit = (e) => {
    e.preventDefault()
    if (playerName.trim()) {
      setHasName(true)
      const pathParts = window.location.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2 && roomId) {
        setInGame(true)
      }
    }
  }

  if (inGame) {
    return (
      <ChessGame 
        roomId={roomId} 
        playerName={playerName}
        isPvE={gameMode === 'PVE'}
        difficulty={difficulty}
        onLeave={(errMsg) => {
          setInGame(false)
          setSelectingDifficulty(false)
          setGameMode('PVP')
          window.history.pushState(null, '', '/')
          if (errMsg) {
            setError(errMsg)
            setTimeout(() => setError(''), 3000)
          }
        }} 
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-lime-400 selection:text-black">

      {/* Funky Minimal Background: Faint Chess Grid Motif */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '64px 64px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-12 relative z-10"
      >
        {/* Header - Chunky & Bold */}
        <div className="text-left space-y-2">
          <motion.div
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", damping: 12, delay: 0.2 }}
            className="inline-block mb-4"
          >
            {/* Funky Drop Shadow on Icon */}
            <Crown size={48} className="text-white drop-shadow-[4px_4px_0_rgba(163,230,53,1)]" strokeWidth={2.5} />
          </motion.div>

          <h1 className="text-7xl font-black tracking-tighter text-white uppercase leading-none">
            Ch<span className="text-lime-400">e</span>ss.
          </h1>

          <div className="flex items-center gap-3 text-white/50 font-bold text-xs uppercase tracking-widest pt-2">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-lime-400" /> {/* Square dot for chess vibe */}
              Live
            </span>
            <span>/</span>
            <span>PvP</span>
          </div>
        </div>

        {/* Main Actions - Conditionally Rendered */}
        {!hasName ? (
          <form onSubmit={handleNameSubmit} className="space-y-8">
            <div className="relative group">
              <User className="absolute left-0 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-lime-400 transition-colors" size={24} />
              <input
                type="text"
                placeholder="ENTER YOUR NAME"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
                className="w-full bg-transparent border-b-4 border-white/20 pl-10 pr-4 py-4 text-white text-2xl font-black tracking-widest focus:outline-none focus:border-lime-400 transition-all placeholder:text-white/20 uppercase"
                autoFocus
              />
            </div>
            <motion.button
              type="submit"
              disabled={!playerName.trim()}
              whileHover={{ scale: playerName.trim() ? 1.02 : 1 }}
              whileTap={{ scale: playerName.trim() ? 0.98 : 1 }}
              className="w-full bg-lime-400 text-black font-black py-4 border-2 border-lime-400 transition-all disabled:opacity-20 disabled:border-white/10 disabled:bg-transparent disabled:text-white/50 flex items-center justify-center gap-3 uppercase tracking-widest"
            >
              <span>Continue</span>
              <Play size={18} className="fill-current" />
            </motion.button>
          </form>
        ) : creatingRoom ? (
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div className="relative group">
              <Hash className="absolute left-0 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-lime-400 transition-colors" size={24} />
              <input
                type="text"
                placeholder="ROOM NAME (NO SPACES)"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={20}
                className="w-full bg-transparent border-b-4 border-white/20 pl-10 pr-4 py-4 text-white text-2xl font-black tracking-widest focus:outline-none focus:border-lime-400 transition-all placeholder:text-white/20 uppercase"
                autoFocus
              />
            </div>
            <div className="flex gap-4">
              <motion.button
                type="button"
                onClick={() => setCreatingRoom(false)}
                className="w-1/3 bg-transparent text-white font-black py-4 border-2 border-white/20 hover:border-white transition-all uppercase tracking-widest"
              >
                Back
              </motion.button>
              <motion.button
                type="submit"
                disabled={!roomName.trim()}
                className="flex-1 bg-lime-400 text-black font-black py-4 border-2 border-lime-400 transition-all disabled:opacity-20 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <span>Start</span>
                <Play size={18} className="fill-current" />
              </motion.button>
            </div>
          </form>
        ) : selectingDifficulty ? (
          <div className="space-y-6">
            <h3 className="text-white/50 font-bold text-xs uppercase tracking-[0.3em] text-center mb-4">Select Difficulty</h3>
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: 'Novice', level: 1, desc: 'Depth 1 - Quick Play' },
                { label: 'Intermediate', level: 2, desc: 'Depth 2 - Balanced' },
                { label: 'Advanced', level: 3, desc: 'Depth 3 - Strategic' },
                { label: 'Grandmaster', level: 4, desc: 'Depth 4 - Intense' },
              ].map((d) => (
                <motion.button
                  key={d.level}
                  whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                  onClick={() => handleStartPVE(d.level)}
                  className="w-full border-2 border-white/10 p-4 text-left group transition-all hover:border-lime-400"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white font-black uppercase tracking-widest">{d.label}</span>
                    <ChevronRight size={16} className="text-white/20 group-hover:text-lime-400 transition-colors" />
                  </div>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{d.desc}</p>
                </motion.button>
              ))}
            </div>
            <button
              onClick={() => setSelectingDifficulty(false)}
              className="w-full text-[10px] font-black text-white/30 uppercase tracking-[0.3em] hover:text-white transition-colors pt-4"
            >
              Back to Menu
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <motion.button
              whileHover={{ x: 4, y: -4, boxShadow: "-8px 8px 0 rgba(163,230,53,1)" }}
              whileTap={{ x: 0, y: 0, boxShadow: "0px 0px 0 rgba(163,230,53,1)" }}
              onClick={() => setSelectingDifficulty(true)}
              className="w-full bg-lime-400 text-black font-black py-5 px-6 border-2 border-lime-400 flex items-center justify-between transition-all group"
            >
              <span className="tracking-widest uppercase text-lg">Play vs CPU</span>
              <Play size={24} className="fill-current" />
            </motion.button>

            <motion.button
              whileHover={{ x: 4, y: -4, boxShadow: "-8px 8px 0 rgba(255,255,255,1)" }}
              whileTap={{ x: 0, y: 0, boxShadow: "0px 0px 0 rgba(255,255,255,1)" }}
              onClick={() => setCreatingRoom(true)}
              className="w-full bg-white text-black font-black py-5 px-6 border-2 border-white flex items-center justify-between transition-all group"
            >
              <span className="tracking-widest uppercase text-lg">Multiplayer</span>
              <Users size={24} />
            </motion.button>

            <form onSubmit={handleJoinRoom} className="space-y-4 pt-4 border-t-2 border-white/10">
              <div className="relative group">
                <Hash className="absolute left-0 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-lime-400 transition-colors" size={24} />
                <input
                  type="text"
                  placeholder="ROOM CODE"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="w-full bg-transparent border-b-4 border-white/20 pl-10 pr-4 py-4 text-white text-2xl font-black tracking-widest focus:outline-none focus:border-lime-400 transition-all placeholder:text-white/20 uppercase"
                />
              </div>

              <motion.button
                type="submit"
                disabled={roomId.length < 4}
                whileHover={{ scale: roomId.length >= 4 ? 1.02 : 1 }}
                whileTap={{ scale: roomId.length >= 4 ? 0.98 : 1 }}
                className="w-full border-2 border-white/20 text-white font-black py-4 transition-all disabled:opacity-20 hover:border-white flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                <span>Join Match</span>
                <ChevronRight size={18} />
              </motion.button>
            </form>
          </div>
        )}

        {/* Footer Stats - Brutalist Info Display */}
        <div className="grid grid-cols-2 gap-4 border-2 border-white/10 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Players</span>
            <span className="text-2xl font-black text-white">{stats.onlinePlayers}</span>
          </div>
          <div className="flex flex-col gap-1 border-l-2 border-white/10 pl-4">
            <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Rooms</span>
            <span className="text-2xl font-black text-white">{stats.activeRooms}</span>
          </div>
        </div>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="absolute -top-20 left-0 right-0 bg-red-500 text-black p-4 font-black uppercase tracking-widest text-center text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default App