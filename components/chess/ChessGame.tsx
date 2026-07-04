'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  createInitialState,
  getLegalMoves,
  applyMove,
  isInCheck,
  type GameState,
  type Color,
  type PieceType,
  type Piece,
} from './chessLogic'
import { createGame as createServerGame, makeMove as sendMoveToServer, resignGame as resignServerGame, GameMode } from '@/services/chessService'

// ─── Piece image map ──────────────────────────────────────────────────────────
// Uses the Wikimedia/Colin M.L. Burnett SVG set (public domain), stored in /public/chess/

const PIECE_IMG: Record<Color, Record<PieceType, string>> = {
  white: {
    king:   '/chess/wK.svg',
    queen:  '/chess/wQ.svg',
    rook:   '/chess/wR.svg',
    bishop: '/chess/wB.svg',
    knight: '/chess/wN.svg',
    pawn:   '/chess/wP.svg',
  },
  black: {
    king:   '/chess/bK.svg',
    queen:  '/chess/bQ.svg',
    rook:   '/chess/bR.svg',
    bishop: '/chess/bB.svg',
    knight: '/chess/bN.svg',
    pawn:   '/chess/bP.svg',
  },
}

function PieceSVG({ type, color }: { type: PieceType; color: Color }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PIECE_IMG[color][type]}
      alt={`${color} ${type}`}
      width={45}
      height={45}
      style={{ width: '82%', height: '82%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
      draggable={false}
    />
  )
}

// Keep unicode map only for captured pieces display (small icons)
const PIECE_UNICODE: Record<Color, Record<PieceType, string>> = {
  white: {
    king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙',
  },
  black: {
    king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟',
  },
}

const PIECE_VALUE: Record<PieceType, number> = {
  queen: 9,
  rook: 5,
  bishop: 3,
  knight: 3,
  pawn: 1,
  king: 0,
}

// ─── Timer hook ───────────────────────────────────────────────────────────────

const INITIAL_TIME = 10 * 60 // 10 minutes in seconds

function useChessTimer(
  gameStatus: GameState['status'],
  turn: Color,
  onTimeout: (loser: Color) => void
) {
  const [whiteTime, setWhiteTime] = useState(INITIAL_TIME)
  const [blackTime, setBlackTime] = useState(INITIAL_TIME)
  const [timerActive, setTimerActive] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  const startTimer = useCallback(() => setTimerActive(true), [])

  const resetTimers = useCallback(() => {
    setTimerActive(false)
    setWhiteTime(INITIAL_TIME)
    setBlackTime(INITIAL_TIME)
  }, [])

  useEffect(() => {
    if (gameStatus !== 'playing') {
      setTimerActive(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    if (!timerActive) return

    intervalRef.current = setInterval(() => {
      if (turn === 'white') {
        setWhiteTime((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!)
            onTimeoutRef.current('white')
            return 0
          }
          return t - 1
        })
      } else {
        setBlackTime((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!)
            onTimeoutRef.current('black')
            return 0
          }
          return t - 1
        })
      }
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [timerActive, turn, gameStatus])

  return { whiteTime, blackTime, startTimer, resetTimers }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Captured pieces display ───────────────────────────────────────────────────

function CapturedPieces({ pieces, label }: { pieces: Piece[]; label: string }) {
  const sorted = [...pieces].sort((a, b) => PIECE_VALUE[b.type] - PIECE_VALUE[a.type])
  return (
    <div className="flex items-center gap-1 min-h-6">
      <span className="text-zinc-500 text-xs w-12 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-0.5">
        {sorted.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={PIECE_IMG[p.color][p.type]}
            alt={`${p.color} ${p.type}`}
            width={22}
            height={22}
            className={`w-5 h-5 object-contain ${p.color === 'black' ? 'drop-shadow-[0_0_1px_rgba(255,255,255,0.9)]' : ''}`}
            style={p.color === 'black' ? { filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px white)' } : undefined}
            draggable={false}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Timer display ────────────────────────────────────────────────────────────

function TimerDisplay({ time, active, label }: { time: number; active: boolean; label: string }) {
  const isLow = time < 60
  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
      active
        ? 'bg-zinc-800 border-zinc-600'
        : 'bg-zinc-900 border-zinc-800'
    }`}>
      <span className="text-sm text-zinc-400">{label}</span>
      <span className={`font-mono text-xl font-bold ${
        isLow ? 'text-red-400' : active ? 'text-white' : 'text-zinc-400'
      }`}>
        {formatTime(time)}
      </span>
    </div>
  )
}

// ─── Promotion dialog ─────────────────────────────────────────────────────────

function PromotionDialog({
  color,
  onSelect,
}: {
  color: Color
  onSelect: (piece: PieceType) => void
}) {
  const choices: PieceType[] = ['queen', 'rook', 'bishop', 'knight']
  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 rounded-lg">
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-2xl">
        <p className="text-white text-sm font-medium mb-3 text-center">Choose promotion</p>
        <div className="flex gap-3">
          {choices.map((p) => (
            <button
              key={p}
              onClick={() => onSelect(p)}
              className="w-14 h-14 flex items-center justify-center text-4xl bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors border border-zinc-600 hover:border-zinc-400"
              title={p}
            >
              {PIECE_UNICODE[color][p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Chess Game component ────────────────────────────────────────────────

export default function ChessGame() {
  const [gameState, setGameState] = useState<GameState>(createInitialState)
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [legalMoves, setLegalMoves] = useState<[number, number][]>([])
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: [number, number]
    to: [number, number]
  } | null>(null)
  const [dragFrom, setDragFrom] = useState<[number, number] | null>(null)
  const [dragOver, setDragOver] = useState<[number, number] | null>(null)
  const [resigned, setResigned] = useState<Color | null>(null)
  const [timedOut, setTimedOut] = useState<Color | null>(null)
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.Practice)
  const [waitingForServer, setWaitingForServer] = useState(false)

  // Move history navigation
  const [boardHistory, setBoardHistory] = useState<GameState[]>([createInitialState()])
  const [viewingIndex, setViewingIndex] = useState<number | null>(null) // null = viewing current/live
  const isViewingHistory = viewingIndex !== null
  const displayedState = isViewingHistory ? boardHistory[viewingIndex] : gameState
  const lastGameStateRef = useRef(gameState)

  // Track board history: whenever gameState changes (and it's a new state), push it
  useEffect(() => {
    if (gameState !== lastGameStateRef.current) {
      lastGameStateRef.current = gameState
      setBoardHistory((prev) => {
        // Avoid duplicate pushes: only push if the board is different from the last entry
        const last = prev[prev.length - 1]
        if (last === gameState) return prev
        return [...prev, gameState]
      })
      setViewingIndex(null)
    }
  }, [gameState])

  const handleTimeout = useCallback((loser: Color) => {
    setTimedOut(loser)
    setSelected(null)
    setLegalMoves([])
  }, [])

  const effectiveStatus: GameState['status'] = (resigned || timedOut) ? 'checkmate' : gameState.status
  const effectiveWinner: Color | null = resigned
    ? (resigned === 'white' ? 'black' : 'white')
    : timedOut
    ? (timedOut === 'white' ? 'black' : 'white')
    : gameState.winner

  const { whiteTime, blackTime, startTimer, resetTimers } = useChessTimer(
    effectiveStatus,
    gameState.turn,
    handleTimeout
  )

  const timerStarted = useRef(false)
  const gameStartTime = useRef<Date | null>(null)
  const serverGameId = useRef<string | null>(null)

  // History navigation
  function goToMove(index: number) {
    if (index < 0 || index >= boardHistory.length) return
    setViewingIndex(index)
    setSelected(null)
    setLegalMoves([])
  }

  function goBack() {
    if (viewingIndex === null) {
      goToMove(boardHistory.length - 2)
    } else if (viewingIndex > 0) {
      goToMove(viewingIndex - 1)
    }
  }

  function goForward() {
    if (viewingIndex === null) return
    if (viewingIndex >= boardHistory.length - 2) {
      setViewingIndex(null)
    } else {
      goToMove(viewingIndex + 1)
    }
  }

  function goToLive() {
    setViewingIndex(null)
    setSelected(null)
    setLegalMoves([])
  }

  // ─── Persist game when it ends ──────────────────────────────────────────────
  // (No longer needed — moves are persisted individually)

  function handleNewGame() {
    const initial = createInitialState()
    setGameState(initial)
    setBoardHistory([initial])
    setViewingIndex(null)
    lastGameStateRef.current = initial
    setSelected(null)
    setLegalMoves([])
    setPendingPromotion(null)
    setDragFrom(null)
    setDragOver(null)
    setResigned(null)
    setTimedOut(null)
    setWaitingForServer(false)
    resetTimers()
    timerStarted.current = false
    gameStartTime.current = null
    serverGameId.current = null
  }

  function handleResign() {
    if (effectiveStatus !== 'playing') return
    setResigned(gameState.turn)
    setSelected(null)
    setLegalMoves([])

    if (serverGameId.current) {
      resignServerGame(serverGameId.current).catch((err) => {
        console.warn('Failed to resign on server:', err)
      })
    }
  }

  function tryMove(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    const piece = gameState.board[fromRow][fromCol]
    if (!piece) return

    const legal = getLegalMoves(gameState, fromRow, fromCol)
    const isLegal = legal.some(([r, c]) => r === toRow && c === toCol)
    if (!isLegal) return

    // Check promotion
    if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
      setPendingPromotion({ from: [fromRow, fromCol], to: [toRow, toCol] })
      setSelected(null)
      setLegalMoves([])
      return
    }

    commitMove(fromRow, fromCol, toRow, toCol, 'queen')
  }

  function commitMove(fromRow: number, fromCol: number, toRow: number, toCol: number, promotion: PieceType) {
    if (!timerStarted.current) {
      timerStarted.current = true
      gameStartTime.current = new Date()
      startTimer()
    }

    // Convert to UCI
    const uci = toUci(fromRow, fromCol, toRow, toCol, promotion)

    // Apply our move immediately for instant feedback
    const newState = applyMove(gameState, fromRow, fromCol, toRow, toCol, promotion)
    setGameState(newState)
    setSelected(null)
    setLegalMoves([])
    setPendingPromotion(null)

    // If no server game yet (first move), create one then send the move
    if (!serverGameId.current) {
      setWaitingForServer(true)
      createServerGame(gameMode)
        .then((gameId) => {
          serverGameId.current = gameId
          console.log('Server game created on first move, id:', gameId, 'mode:', gameMode)
          return sendMoveToServer(gameId!, uci)
        })
        .then((response) => {
          if (gameMode === GameMode.VsComputer && response.computerMoveUci) {
            const compMove = parseUci(response.computerMoveUci)
            if (compMove) {
              setGameState((prev) => applyMove(prev, compMove.fromRow, compMove.fromCol, compMove.toRow, compMove.toCol, compMove.promotion))
            }
          }
          setWaitingForServer(false)
        })
        .catch((err) => {
          console.error('Failed to create game or send move:', err)
          setWaitingForServer(false)
        })
    } else {
      // Server game exists — just send the move
      setWaitingForServer(true)
      sendMoveToServer(serverGameId.current, uci)
        .then((response) => {
          if (gameMode === GameMode.VsComputer && response.computerMoveUci) {
            const compMove = parseUci(response.computerMoveUci)
            if (compMove) {
              setGameState((prev) => applyMove(prev, compMove.fromRow, compMove.fromCol, compMove.toRow, compMove.toCol, compMove.promotion))
            }
          }
          setWaitingForServer(false)
        })
        .catch((err) => {
          console.error('Move rejected by server:', err)
          // Rollback: revert to state before our move
          setGameState(gameState)
          setWaitingForServer(false)
        })
    }
  }

  function handleSquareClick(row: number, col: number) {
    if (effectiveStatus !== 'playing') return
    if (waitingForServer) return
    if (isViewingHistory) return

    const piece = gameState.board[row][col]

    // If we have a piece selected
    if (selected) {
      const [sr, sc] = selected

      // Clicked the same square → deselect
      if (sr === row && sc === col) {
        setSelected(null)
        setLegalMoves([])
        return
      }

      // Try to move to this square
      const isTarget = legalMoves.some(([r, c]) => r === row && c === col)
      if (isTarget) {
        tryMove(sr, sc, row, col)
        return
      }

      // Select a different piece of the same color
      if (piece && piece.color === gameState.turn) {
        const moves = getLegalMoves(gameState, row, col)
        setSelected([row, col])
        setLegalMoves(moves)
        return
      }

      // Clicked empty / enemy not in move list → deselect
      setSelected(null)
      setLegalMoves([])
      return
    }

    // No piece selected — select if it's the current player's piece
    if (piece && piece.color === gameState.turn) {
      const moves = getLegalMoves(gameState, row, col)
      setSelected([row, col])
      setLegalMoves(moves)
    }
  }

  // ─── Drag & drop ─────────────────────────────────────────────────────────────

  function handleDragStart(row: number, col: number, e: React.DragEvent) {
    const piece = gameState.board[row][col]
    if (!piece || piece.color !== gameState.turn || effectiveStatus !== 'playing' || waitingForServer || isViewingHistory) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    setDragFrom([row, col])
    const moves = getLegalMoves(gameState, row, col)
    setSelected([row, col])
    setLegalMoves(moves)
  }

  function handleDragOver(row: number, col: number, e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver([row, col])
  }

  function handleDrop(row: number, col: number, e: React.DragEvent) {
    e.preventDefault()
    setDragOver(null)
    if (!dragFrom) return
    const [fr, fc] = dragFrom
    tryMove(fr, fc, row, col)
    setDragFrom(null)
  }

  function handleDragEnd() {
    setDragFrom(null)
    setDragOver(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const inCheck = effectiveStatus === 'playing' && isInCheck(gameState.board, gameState.turn)
  const checkedKingPos = inCheck ? findKingPosition(gameState.board, gameState.turn) : null

  const legalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`))

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start justify-center w-full">
      {/* Board side */}
      <div className="flex flex-col items-center gap-3">
        {/* Black timer (top) */}
        <div className="w-full max-w-[512px]">
          <TimerDisplay time={blackTime} active={gameState.turn === 'black' && effectiveStatus === 'playing'} label="Black" />
        </div>

        {/* Black's captured pieces (white pieces that black took) — shown on black's side */}
        <div className="w-full max-w-[512px]">
          <CapturedPieces pieces={gameState.capturedByBlack} label="Black" />
        </div>

        {/* Board */}
        <div className="relative">
          {pendingPromotion && (
            <PromotionDialog
              color={gameState.turn === 'white' ? 'white' : 'black'}
              onSelect={(p) => {
                if (!pendingPromotion) return
                commitMove(
                  pendingPromotion.from[0],
                  pendingPromotion.from[1],
                  pendingPromotion.to[0],
                  pendingPromotion.to[1],
                  p
                )
              }}
            />
          )}

          {/* Game over overlay */}
          {effectiveStatus !== 'playing' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 rounded-lg">
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center shadow-2xl">
                <p className="text-2xl font-bold text-white mb-2">
                  {effectiveStatus === 'checkmate' && `${capitalize(effectiveWinner!)} wins!`}
                  {effectiveStatus === 'stalemate' && 'Stalemate'}
                  {effectiveStatus === 'draw' && 'Draw'}
                </p>
                <p className="text-zinc-400 text-sm mb-5">
                  {effectiveStatus === 'checkmate' && timedOut
                    ? `${capitalize(timedOut)} ran out of time`
                    : effectiveStatus === 'checkmate' && resigned
                    ? `${capitalize(resigned)} resigned`
                    : effectiveStatus === 'checkmate'
                    ? 'Checkmate'
                    : effectiveStatus === 'stalemate'
                    ? 'No legal moves available'
                    : '50-move rule'}
                </p>
                <button
                  onClick={handleNewGame}
                  className="px-5 py-2 bg-white text-zinc-900 font-semibold rounded-full hover:bg-zinc-200 transition-colors"
                >
                  New Game
                </button>
              </div>
            </div>
          )}

          <div
            className="border-2 border-zinc-600 rounded overflow-hidden"
            style={{ width: 'min(512px, 90vw)', height: 'min(512px, 90vw)' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 12.5%)',
                gridTemplateRows: 'repeat(8, 12.5%)',
                width: '100%',
                height: '100%',
              }}
            >
            {displayedState.board.map((rowArr, row) =>
              rowArr.map((piece, col) => {
                const isLight = (row + col) % 2 === 0
                const isSelected = selected ? selected[0] === row && selected[1] === col : false
                const isLegalTarget = legalSet.has(`${row},${col}`)
                const isLastMoveFrom = displayedState.lastMove?.from[0] === row && displayedState.lastMove?.from[1] === col
                const isLastMoveTo = displayedState.lastMove?.to[0] === row && displayedState.lastMove?.to[1] === col
                const isCheckedKing = checkedKingPos ? checkedKingPos[0] === row && checkedKingPos[1] === col : false
                const isDragTarget = dragOver ? dragOver[0] === row && dragOver[1] === col : false
                const isDragSource = dragFrom ? dragFrom[0] === row && dragFrom[1] === col : false

                let squareBg = isLight ? 'bg-amber-100' : 'bg-amber-800'
                if (isSelected || isDragSource) squareBg = 'bg-yellow-400'
                else if (isLastMoveFrom || isLastMoveTo) squareBg = isLight ? 'bg-yellow-200' : 'bg-yellow-600'
                if (isCheckedKing) squareBg = 'bg-red-500'
                if (isDragTarget && isLegalTarget) squareBg = isLight ? 'bg-green-300' : 'bg-green-600'

                return (
                  <div
                    key={`${row}-${col}`}
                    className={`relative flex items-center justify-center cursor-pointer select-none ${squareBg} transition-colors`}
                    onClick={() => handleSquareClick(row, col)}
                    onDragOver={(e) => handleDragOver(row, col, e)}
                    onDrop={(e) => handleDrop(row, col, e)}
                    aria-label={`${colToFile(col)}${rowToRank(row)}${piece ? ` ${piece.color} ${piece.type}` : ''}`}
                  >
                    {/* Rank & file labels */}
                    {col === 0 && (
                      <span className={`absolute top-0.5 left-0.5 text-[10px] font-medium leading-none ${isLight ? 'text-amber-800' : 'text-amber-100'}`}>
                        {rowToRank(row)}
                      </span>
                    )}
                    {row === 7 && (
                      <span className={`absolute bottom-0.5 right-1 text-[10px] font-medium leading-none ${isLight ? 'text-amber-800' : 'text-amber-100'}`}>
                        {colToFile(col)}
                      </span>
                    )}

                    {/* Legal move indicator */}
                    {isLegalTarget && !piece && (
                      <div className="absolute w-[30%] h-[30%] rounded-full bg-black/20 pointer-events-none" />
                    )}
                    {isLegalTarget && piece && (
                      <div className="absolute inset-0 rounded-none border-4 border-black/30 pointer-events-none" />
                    )}

                    {/* Piece */}
                    {piece && (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(row, col, e)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-center w-full h-full z-10 transition-transform ${
                          isDragSource ? 'opacity-40' : 'hover:scale-110'
                        }`}
                        style={{ cursor: piece.color === gameState.turn && effectiveStatus === 'playing' ? 'grab' : 'default' }}
                        aria-hidden="true"
                      >
                        <PieceSVG type={piece.type} color={piece.color} />
                      </div>
                    )}
                  </div>
                )
              })
            )}
            </div>
          </div>
        </div>

        {/* White's captured pieces (black pieces that white took) — shown on white's side */}
        <div className="w-full max-w-[512px]">
          <CapturedPieces pieces={gameState.capturedByWhite} label="White" />
        </div>

        {/* White timer (bottom) */}
        <div className="w-full max-w-[512px]">
          <TimerDisplay time={whiteTime} active={gameState.turn === 'white' && effectiveStatus === 'playing'} label="White" />
        </div>
      </div>

      {/* Control panel */}
      <div className="flex flex-col gap-4 w-full lg:w-56">
        {/* Turn indicator */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Current turn</p>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full border-2 ${gameState.turn === 'white' ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-400'}`} />
            <span className="text-white font-medium capitalize">{gameState.turn}</span>
            {inCheck && (
              <span className="text-xs text-red-400 font-medium ml-auto">CHECK</span>
            )}
          </div>
        </div>

        {/* Move counter */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">
          Move <span className="text-white font-semibold">{gameState.fullMoveNumber}</span>
        </div>

        {/* Game mode selector */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-2">Game Mode</p>
          <div className="flex gap-2">
            <button
              onClick={() => setGameMode(GameMode.Practice)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                gameMode === GameMode.Practice
                  ? 'bg-white text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Practice
            </button>
            <button
              onClick={() => setGameMode(GameMode.VsComputer)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                gameMode === GameMode.VsComputer
                  ? 'bg-white text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              vs Computer
            </button>
          </div>
        </div>

        {/* Buttons */}
        <button
          onClick={handleNewGame}
          disabled={effectiveStatus === 'playing' && gameState.moveHistory.length > 0}
          className="px-4 py-2.5 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
        >
          New Game
        </button>
        <button
          onClick={handleResign}
          disabled={effectiveStatus !== 'playing'}
          className="px-4 py-2.5 border border-red-800 text-red-400 font-semibold rounded-lg hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
        >
          Resign
        </button>

        {/* Move History */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 max-h-64 overflow-y-auto">
          <p className="text-zinc-400 font-medium text-xs mb-2">Move history</p>
          {gameState.moveHistory.length === 0 ? (
            <p className="text-zinc-600 text-xs">No moves yet</p>
          ) : (
            <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-0.5 text-xs font-mono">
              {Array.from({ length: Math.ceil(gameState.moveHistory.length / 2) }).map((_, i) => {
                const whiteMove = gameState.moveHistory[i * 2]
                const blackMove = gameState.moveHistory[i * 2 + 1]
                return (
                  <div key={i} className="contents">
                    <span className="text-zinc-600">{i + 1}.</span>
                    <span className="text-white">{whiteMove}</span>
                    <span className="text-zinc-300">{blackMove ?? ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Move navigation */}
        {gameState.moveHistory.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={goBack}
              disabled={viewingIndex === 0}
              className="flex-1 px-2 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
              title="Previous move"
            >
              ◀
            </button>
            <button
              onClick={goForward}
              disabled={viewingIndex === null}
              className="flex-1 px-2 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
              title="Next move"
            >
              ▶
            </button>
            <button
              onClick={goToLive}
              disabled={viewingIndex === null}
              className="flex-1 px-2 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
              title="Current position"
            >
              ⏭
            </button>
          </div>
        )}
        {isViewingHistory && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-3 py-1.5 text-yellow-300 text-xs text-center">
            Viewing move {viewingIndex} of {boardHistory.length - 1}
          </div>
        )}

        {/* Legend */}
        <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
          <p className="text-zinc-400 font-medium mb-2 text-xs">How to play</p>
          <p>• Click a piece to see legal moves</p>
          <p>• Click a highlighted square to move</p>
          <p>• Or drag &amp; drop pieces</p>
          <p>• 10 min per player</p>
          <p>• Timer starts on first move</p>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToRank(row: number): string {
  return String(8 - row)
}

function colToFile(col: number): string {
  return String.fromCharCode(97 + col)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function findKingPosition(board: GameState['board'], color: Color): [number, number] | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'king' && p.color === color) return [r, c]
    }
  }
  return null
}

/** Convert board coordinates + promotion to UCI notation (e.g. "e2e4", "e7e8q") */
function toUci(fromRow: number, fromCol: number, toRow: number, toCol: number, promotion: PieceType): string {
  const from = colToFile(fromCol) + rowToRank(fromRow)
  const to = colToFile(toCol) + rowToRank(toRow)
  const promo = (fromRow === 6 && toRow === 7) || (fromRow === 1 && toRow === 0)
    ? promotion === 'queen' ? 'q' : promotion === 'rook' ? 'r' : promotion === 'bishop' ? 'b' : 'n'
    : ''
  return from + to + promo
}

/** Parse a UCI string (e.g. "e2e4", "e7e8q") into board coordinates */
function parseUci(uci: string): { fromRow: number; fromCol: number; toRow: number; toCol: number; promotion: PieceType } | null {
  if (uci.length < 4) return null
  const fromCol = uci.charCodeAt(0) - 97
  const fromRow = 8 - parseInt(uci[1], 10)
  const toCol = uci.charCodeAt(2) - 97
  const toRow = 8 - parseInt(uci[3], 10)
  let promotion: PieceType = 'queen'
  if (uci.length === 5) {
    const p = uci[4]
    promotion = p === 'r' ? 'rook' : p === 'b' ? 'bishop' : p === 'n' ? 'knight' : 'queen'
  }
  if (fromCol < 0 || fromCol > 7 || toCol < 0 || toCol > 7 || fromRow < 0 || fromRow > 7 || toRow < 0 || toRow > 7) return null
  return { fromRow, fromCol, toRow, toCol, promotion }
}



